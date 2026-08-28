# WebMCP tools

This extension registers in-page tools on `document.modelContext` so ChatGPT or Chrome can operate the live OHIF viewer.

Worklist tools (`search_studies`, `open_study`) register on `/`. Viewer tools register after `VIEWPORTS_READY` and unregister when the mode exits.

Outputs omit PatientName, PatientID, and birth date. Study, series, and measurement identifiers are short ids (`s1`, `ds1`, `m1`) that later tools resolve.

The human still places Length and Bidirectional handles. The agent hangs layout, applies window/level, labels measurements, and downloads a DICOM SR after a confirm dialog.
