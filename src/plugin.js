/**
 * Copyright (c) 2018-present The Palmer Group
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import fs from 'fs-extra';
import { diffImageToSnapshot } from 'jest-image-snapshot/src/diff-snapshot';
import { MATCH, RECORD } from './constants';

let snapshotOptions = {};
let snapshotResults = {};
let snapshotRunning = false;
const kebabSnap = '-snap.png';
const kebabSnapFail = '-snap-FAIL.png';
const dotSnap = '.snap.png';
const dotDiff = '.diff.png';

export function matchImageSnapshotOptions(options = {}) {
  snapshotOptions = options;
  snapshotRunning = true;
  return null;
}

export function matchImageSnapshotResults() {
  snapshotRunning = false;
  return snapshotResults;
}

export function matchImageSnapshotPlugin({ path: screenshotPath }) {
  if (!snapshotRunning) {
    return null;
  }

  const {
    screenshotsFolder,
    updateSnapshots,
    options: {
      failureThreshold = 0,
      failureThresholdType = 'pixel',
      customSnapshotsDir,
      customDiffDir,
      ...options
    } = {},
  } = snapshotOptions;

  const receivedImageBuffer = fs.readFileSync(screenshotPath);
  const screenshotFileName = screenshotPath.slice(
    screenshotPath.lastIndexOf(path.sep) + 1
  );
  const screenshotDir = screenshotPath.replace(screenshotFileName, '');
  const relativePath = screenshotDir.match(/screenshots(.*)/)[1];
  const snapshotIdentifier = screenshotFileName.replace('.png', '');
  const snapshotsDir = customSnapshotsDir
    ? path.join(process.cwd(), customSnapshotsDir, relativePath)
    : path.join(screenshotsFolder, '..', 'snapshots', relativePath);

  const snapshotKebabPath = path.join(
    snapshotsDir,
    `${snapshotIdentifier}${kebabSnap}`
  );
  const snapshotKebabPathFail = path.join(
    snapshotsDir,
    `${snapshotIdentifier}${kebabSnapFail}`
  );
  const snapshotDotPath = path.join(
    snapshotsDir,
    `${snapshotIdentifier}${dotSnap}`
  );

  const diffDir = customDiffDir
    ? path.join(process.cwd(), customDiffDir, relativePath)
    : path.join(snapshotsDir, '__diff_output__');
  const diffDotPath = path.join(diffDir, `${snapshotIdentifier}${dotDiff}`);

  if (fs.pathExistsSync(snapshotDotPath)) {
    fs.copySync(snapshotDotPath, snapshotKebabPath);
  }

  snapshotResults = diffImageToSnapshot({
    snapshotsDir,
    receivedImageBuffer,
    snapshotIdentifier,
    failureThreshold,
    failureThresholdType,
    updateSnapshot: updateSnapshots,
    ...options,
  });

  const { pass, added, updated, diffOutputPath } = snapshotResults;

  if (!pass && !added && !updated) {
    fs.copySync(diffOutputPath, diffDotPath);
    fs.removeSync(diffOutputPath);
    fs.removeSync(snapshotKebabPath);
    fs.writeFileSync(snapshotKebabPathFail, receivedImageBuffer)
    snapshotResults.diffOutputPath = diffDotPath;

    console.log(
      `Screenshot was different from saved snapshot.\n  See diff for details: ${snapshotResults.diffOutputPath}`
    );

    return {
      path: diffDotPath,
    };
  }

  fs.copySync(snapshotKebabPath, snapshotDotPath);
  fs.removeSync(snapshotKebabPath);
  snapshotResults.diffOutputPath = snapshotDotPath;

  return {
    path: snapshotDotPath,
  };
}

export function addMatchImageSnapshotPlugin(on) {
  on('task', {
    [MATCH]: matchImageSnapshotOptions,
    [RECORD]: matchImageSnapshotResults,
  });
  on('after:screenshot', matchImageSnapshotPlugin);
}
