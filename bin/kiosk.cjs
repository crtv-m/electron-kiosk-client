#!/usr/bin/env node
// Запускаем Electron из установленного пакета
const path = require('path');
const { spawn } = require('child_process');
const electronPath = require('electron');

const cwd = path.join(__dirname, '..');
const child = spawn(electronPath, ['.'], { cwd, stdio: 'inherit', env: process.env });

child.on('exit', code => process.exit(code));
