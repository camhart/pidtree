'use strict';
var os = require('os');
var bin = require('./bin');

/**
 * Gets the list of all the pids of the system through PowerShell.
 * Works with both older and newer Windows versions.
 * @param  {Function} callback(err, list)
 */
function getProcesses(callback) {
  // Check PowerShell version first to determine what command to use
  var checkVersionArgs = [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '$PSVersionTable.PSVersion.Major'
  ];

  bin('powershell', checkVersionArgs, {windowsHide: true}, function(err, stdout, code) {
    if (err) {
      callback(err);
      return;
    }

    var psVersion = parseInt(stdout.trim(), 10);
    var args;

    if (psVersion >= 3) {
      // For PowerShell 3.0 and above, use Get-CimInstance
      args = [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance -ClassName Win32_Process | Select-Object ParentProcessId, ProcessId | Format-Table -HideTableHeaders'
      ];
    } else {
      // For PowerShell 2.0 and below, use Get-WmiObject
      args = [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-WmiObject -Class Win32_Process | Select-Object ParentProcessId, ProcessId | Format-Table -HideTableHeaders'
      ];
    }

    var options = {windowsHide: true, windowsVerbatimArguments: true};

    bin('powershell', args, options, function(err, stdout, code) {
      if (err) {
        callback(err);
        return;
      }
      if (code !== 0) {
        callback(new Error('pidtree PowerShell command exited with code ' + code));
        return;
      }

      try {
        stdout = stdout.split(os.EOL);
        var list = [];
        for (var i = 0; i < stdout.length; i++) {
          var line = stdout[i].trim();
          if (!line) continue; // Skip empty lines

          // Split by multiple spaces
          var parts = line.split(/\s+/);

          // Skip lines that don't have at least two parts
          if (parts.length < 2) continue;

          var ppid = parseInt(parts[0], 10);
          var pid = parseInt(parts[1], 10);

          // Skip if either parse resulted in NaN
          if (isNaN(ppid) || isNaN(pid)) continue;

          list.push([ppid, pid]);
        }
        callback(null, list);
      } catch (error) {
        callback(error);
      }
    });
  });
}

module.exports = getProcesses;
