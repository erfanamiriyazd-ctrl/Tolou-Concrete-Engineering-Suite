# Tolou Concrete Engineering Suite — Delivery Roadmap

## Current baseline
- Engineering core completed through Stage 6.5.
- Stage 6.5 is the current Golden Baseline for the existing application behavior.
- Development from this point is productization for a complete Windows release.
- Do not remove or silently simplify existing engineering capabilities.

## Development policy
- Preserve working behavior first.
- No broad rewrite/refactor unless required by a concrete defect or packaging constraint.
- No mandatory continuous CI loop for every small change.
- Use focused smoke checks during implementation and one broader regression pass before Release Candidate.
- Existing engineering engines, reports, workflows, data contracts, QC, Trial, Production, Economics, Optimization and Knowledge layers must remain available.
- Online capability is allowed. Offline-only operation is NOT a release requirement.
- No feature may be removed merely to simplify Windows packaging.

## Windows product milestones

### W1 — Windows Application Shell ✅ COMPLETE
- Wrap the accepted application in a Windows desktop shell.
- Preserve the current UI and engineering engines.
- Define application identity, product name and versioning.
- Establish safe local user-data paths.

### W2 — Persistent Data & Migration ✅ CORE COMPLETE
- Introduce persistence behind an adapter rather than rewriting the engineering core.
- Preserve existing data where possible.
- Add migration and recovery paths.
- Add user-visible backup/restore where required.

### W3 — Windows Integration 🚧 IN PROGRESS
- Application icon.
- Installer icon.
- Installed executable icon.
- Start Menu entry.
- Desktop shortcut with the same official icon.
- Correct app name and publisher metadata.
- User-data location and update-safe storage.
- File/export dialogs where the current app requires them.

### W4 — Installer & Uninstaller
- Build a complete Windows installer.
- Installer must create the desktop shortcut.
- Installer must create the Start Menu shortcut.
- Installer must install the final icon resources.
- Uninstaller must remove application files without silently deleting user engineering data unless explicitly requested.
- Installed application must launch normally after installation.

### W5 — Release Candidate
- Focused end-to-end smoke test.
- Installer test on clean Windows environment.
- Launch/close/relaunch.
- Data persistence.
- Core engineering calculation.
- Trial/QC workflow.
- Report/export.
- Backup/restore.
- Shortcut and icon verification.
- One final regression pass before release.

### W6 — Windows v1.0
Deliverables:
- Windows installer executable.
- Installed desktop application.
- Official app icon embedded in executable.
- Official icon on installer.
- Official icon on desktop shortcut.
- Start Menu shortcut.
- Uninstaller.
- Version metadata.
- Release notes.
- Preserved engineering functionality from Golden Baseline.

## Release principle
The release target is not a reduced desktop demo. It is the full Tolou engineering application packaged as a professional Windows product.
