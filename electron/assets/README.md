# AirClick Overlay Assets

## Tray Icon Requirements

Place your tray icon files in this directory:

- **tray-icon.png** - PNG format, 16x16 or 32x32 pixels, transparent background
- **icon.ico** - Windows icon (optional, for installer)
- **icon.icns** - macOS icon (optional, for dmg)

### Creating a Simple Tray Icon

You can create a simple icon using any image editor. For now, the app will use a fallback empty icon if no icon is found.

### Quick Icon Creation (PowerShell):

```powershell
# Install ImageMagick (if not installed)
# choco install imagemagick

# Create a simple 32x32 hand icon placeholder
# (This is just a placeholder - replace with your actual icon)
```

### Temporary Solution

The app will work without custom icons - it will use Electron's default empty tray icon.

For production, add a proper 32x32px PNG icon named `tray-icon.png` in this directory.
