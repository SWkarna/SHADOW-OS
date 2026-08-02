import { IpcMain, app } from 'electron'
import { exec } from 'child_process'
import os from 'os'
import path from 'path'

const runCommand = (cmd: string): Promise<string> => {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => {
      resolve(err ? '' : stdout.trim())
    })
  })
}

export default function registerFileScanner(ipcMain: IpcMain) {

  ipcMain.removeHandler('get-running-apps')

  ipcMain.handle('get-running-apps', async () => {
    try {
      if (os.platform() === 'win32') {
        const cmd = `powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty ProcessName"`
        const output = await runCommand(cmd)
        const apps = output
          .split(/\r?\n/)
          .map((a) => a.trim())
          .filter((a) => a)

        // Build a set of self process name variants to exclude (case-insensitive)
        const selfNames = new Set<string>()
        try {
          const appName = (app && app.getName && app.getName()) || ''
          if (appName) {
            selfNames.add(appName.toLowerCase())
            selfNames.add(appName.replace(/\s+/g, '').toLowerCase())
          }
        } catch (e) {}
        try {
          const execName = path.basename(process.execPath || '').toLowerCase()
          if (execName) {
            selfNames.add(execName)
            if (execName.endsWith('.exe')) selfNames.add(execName.replace(/\.exe$/, ''))
          }
        } catch (e) {}
        // Common Electron variants
        selfNames.add('electron')
        selfNames.add('electron.exe')
        selfNames.add('shadow')
        selfNames.add('shadow.exe')

        const filtered = apps.filter((a) => !selfNames.has(a.toLowerCase()))
        return [...new Set(filtered)]
      }

      if (os.platform() === 'darwin') {
        const cmd = `osascript -e 'tell application "System Events" to get name of (processes where background only is false)'`
        const output = await runCommand(cmd)
        return output.split(', ').map((s) => s.trim())
      }

      return [] 
    } catch (e) {
      return []
    }
  })
}
