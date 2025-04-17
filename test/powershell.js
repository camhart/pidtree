import test from 'ava';
import mockery from 'mockery';

import pify from 'pify';

import mocks from './helpers/mocks';

test.before(() => {
  mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false,
    useCleanCache: true,
  });
});

test.beforeEach(() => {
  mockery.resetCache();
});

test.after(() => {
  mockery.disable();
});

test('should parse PowerShell output on Windows', async t => {
  // Format mimics PowerShell output from Get-CimInstance with Format-Table -HideTableHeaders
  const stdout =
    `      0       777\r\r\n` +
    `    777       778\r\r\n` +
    `      0       779\r\r\n\r\r\n`;

  mockery.registerMock('child_process', {
    spawn: () => mocks.spawn(stdout, '', null, 0, null),
  });
  mockery.registerMock('os', {
    EOL: '\r\n',
    platform: () => 'linux',
    type: () => 'type',
    release: () => 'release',
  });

  const getProcesses = require('../lib/powershell');

  const result = await pify(getProcesses)();
  t.deepEqual(result, [[0, 777], [777, 778], [0, 779]]);

  mockery.deregisterMock('child_process');
  mockery.deregisterMock('os');
});

test('should handle empty or invalid lines', async t => {
  // Test with some empty lines and invalid format lines
  const stdout =
    `      0       777\r\r\n` +
    `\r\r\n` +
    `    invalid line\r\r\n` +
    `    777       778\r\r\n` +
    `      0       779\r\r\n\r\r\n`;

  mockery.registerMock('child_process', {
    spawn: () => mocks.spawn(stdout, '', null, 0, null),
  });
  mockery.registerMock('os', {
    EOL: '\r\n',
    platform: () => 'linux',
    type: () => 'type',
    release: () => 'release',
  });

  const getProcesses = require('../lib/powershell');

  const result = await pify(getProcesses)();

  // Let's log the actual result for debugging
  console.log('Actual result:', JSON.stringify(result));

  // Check that we have the expected number of valid entries
  t.is(result.length, 3);

  // Check individual entries match expected values
  // Using JSON.stringify for comparison to handle array nesting
  t.is(JSON.stringify(result[0]), JSON.stringify([0, 777]));
  t.is(JSON.stringify(result[1]), JSON.stringify([777, 778]));
  t.is(JSON.stringify(result[2]), JSON.stringify([0, 779]));

  mockery.deregisterMock('child_process');
  mockery.deregisterMock('os');
});

test('should handle error code from PowerShell', async t => {
  mockery.registerMock('child_process', {
    spawn: () => mocks.spawn('', '', null, 1, null),
  });
  mockery.registerMock('os', {
    EOL: '\r\n',
    platform: () => 'linux',
    type: () => 'type',
    release: () => 'release',
  });

  const getProcesses = require('../lib/powershell');

  // Use older AVA throws method instead of throwsAsync
  try {
    await pify(getProcesses)();
    t.fail('Expected promise to reject');
  } catch (error) {
    t.is(error.message, 'pidtree PowerShell command exited with code 1');
  }

  mockery.deregisterMock('child_process');
  mockery.deregisterMock('os');
});
