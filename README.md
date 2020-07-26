# Taskflow Electron Application Samples

This repository contains samples of my work on the TaskFlow Electron desktop application at the UMN (shared with permission).

## Zoom API Integration
Integrates our Electron app with the Zoom API to allow users to seamlessly initiate remote support meetings with lab staff. This module uses an event driven architecture, handles OAuth flow, automatically refreshes access tokens, and implements intuitive UI modals to help the user through the process.

## Bluetooth Server Download and Update Manager
Integrates with Github's REST API to download and manage platform-specific releases of our bluetooth serial server that controls a peripheral transcranial direct current stimulation (tDCS) device.

## Build System
Build system using Gulp.js which facilitates development and production builds leveraging Electron Forge and building platform-specific distributables of our python bluetooth serial server using pyinstaller