# Universal Print Agent: Comprehensive Integration & Dimension Guide

This manual serves as the ultimate technical reference for integrating, polling, and configuring network-connected thermal receipt, barcode label, and document line-printers using the **Universal Print Agent** framework.

---

## 1. Supported Printer Handlers & Strategies

The print agent uses a dynamic, decoupled **Strategy & Factory Pattern** matching incoming job specifications against hardware capabilities. On the agent, these are resolved as follows:

| ContentType enum | Internal Strategy Handler | Target Hardware Platforms | Core Capabilities |
| :--- | :--- | :--- | :--- |
| **`ESC_POS`** | `EscPosPrinterHandler` | TVS RP3150 STARI, Epson TM series, Star Micronics, citizen, POS slip & barcode thermal printers. | High-speed direct socket streaming bypass of Windows driver delays, hardware initialization, base64 raw binary command decodes. |
| **`RAW`** | `EscPosPrinterHandler` (Fallback) | Any thermal or receipt device requiring unprocessed instruction streaming. | Direct TCP channel pipe of raw binary packets. |
| **`ZPL`** | `ZplPrinterHandler` | Zebra ZD420/ZT410, industrial or warehouse desktop label engines. | ASCII-to-stream conversion, multi-row duplicate replication for exact batch counts, text/base64 handling. |
| **`TEXT`** | `TextPrinterHandler` | Slips, report line-printers, matrix loggers, diagnostic slip drawers. | Auto copy concatenation, column spacing calculation, basic text alignment layouts. |
| **`PDF`** | `PdfPrinterHandler` | Office network printers, standard enterprise deskjet or laser machines. | Structured binary envelope streaming of Base64 encoded PDFs. |

---

## 2. Printer Type Selection Reference Guide (By Brand & Model)

When registering a printer in your `assignedPrinters` configuration on the server or agent, you must specify the correct `"type"` (also referred to as `printerType`). Choosing the correct type ensures that the agent maps the print jobs to the right low-level protocol handler and connector.

Here is the exact reference guide of which `"type"` to choose based on your physical printer's brand and connection method:

### 1. `"ESC_POS"` (Thermal Receipt & POS Printers)
* **Compatible Brands & Series**: 
  * **TVS Electronics**: RP3150, RP3150 STAR, RP3200, RP3220, RP45
  * **Epson**: TM-T82, TM-T82II, TM-T82III, TM-T88V, TM-T88VI, TM-m30, TM-U220
  * **Star Micronics**: TSP100, TSP650, TSP700
  * **Citizen**: CT-S310, CT-S310II, CT-S601
  * **Other POS Brands**: Xprinter, Bixolon, SEWOO, Rongta, Gprinter
* **When to select**: Select this type when connecting to any standard **3-inch (80mm) or 2-inch (58mm) thermal receipt printer** over direct TCP/IP (Port 9100) or network socket, bypassing any Windows/local OS print drivers to stream raw control characters and barcodes.

### 2. `"Zebra"` (ZPL Label Printers)
* **Compatible Brands & Series**:
  * **Zebra**: ZD220, ZD420, ZT410, ZT420, GK420d, GK420t, GX430t, GC420, LP2844
  * **Other ZPL-Compatible Brands**: Any barcode label printer that fully supports the Zebra Programming Language (ZPL) emulation.
* **When to select**: Select this for **industrial or desktop adhesive label printers** where you are sending native ZPL string templates (`^XA ... ^XZ`) to print barcodes, inventory tags, and shipping labels directly to the printhead.

### 3. `"Brother"` (Brother Label Printers)
* **Compatible Brands & Series**:
  * **Brother QL Series**: QL-800, QL-810W, QL-820NWB, QL-1100, QL-1115NWB
  * **Brother TD Series**: TD-4420DN, TD-4550DNWB
* **When to select**: Select this for dedicated **Brother label printers** running in Brother raster/command mode.

### 4. `"TSC"` (TSC Label Printers)
* **Compatible Brands & Series**:
  * **TSC**: TE200, TE244, TTP-244 Pro, DA210, DA220, MB240
  * **Other TSPL Brands**: Gprinter, Xprinter (models running TSC/TSPL emulation)
* **When to select**: Select this for **TSC thermal label printers** where you send raw TSPL/TSPL2 commands.

### 5. `"PDF"` (Native Network PDF Printers)
* **Compatible Brands & Series**:
  * **Enterprise Office Printers**: HP LaserJet (Pro/Enterprise), Canon imageRUNNER, Xerox VersaLink, Brother MFC series, Lexmark, Ricoh
* **When to select**: **ONLY** select this when you are connecting over Port 9100 directly to a high-end, heavy-duty office printer/copier that has an **embedded hardware-level PDF interpreter** capable of parsing and rendering raw PDF binary file streams directly.
* *Note*: Standard POS receipt printers (like TVS RP3150) **DO NOT** support native PDF interpreter mode directly. If you select `"type": "PDF"` for a POS thermal printer, it will print raw binary PDF code (`%PDF-1.4...`) as gibberish text!

### 6. `"WindowsPrinter"` (Local Driver OS Spooler - Recommended Fallback)
* **Compatible Brands & Series**:
  * **ANY printer brand or model** (TVS RP3150, Epson, Zebra, HP, Canon, etc.) that has its official driver installed on the local Windows/Linux PC where the Universal Print Agent worker is running.
* **When to select**: Select this when you want to utilize the local Operating System's printer queue and GDI Spooler API. 
  * The OS print driver takes care of rendering, graphics scaling, anti-aliasing, and margins automatically.
  * This is the easiest and most reliable way to print standard document formats (like PDFs) to physical thermal receipt printers without needing manual rasterization libraries.

---

## 3. Print Request Payload Schema (POST `/api/jobs`)

When submitting print requests through your central ERP, custom script, or Postman, the request payload matches the following schema.

### Core Payload JSON Attributes
* **`printerId`** (`string`, Required): The exact registered identifier of your printer on the network (e.g., `"TVS3150"`, `"EPS-3150"`, `"ZBR-001"`).
* **`printerType`** or **`type`** (`string`, Required): The driver type to leverage on registration. Supported: `"ESC_POS"`, `"Zebra"`, `"Brother"`, `"TSC"`, `"PDF"`, `"WindowsPrinter"`.
* **`copies`** (`number`): Number of physical copies to trigger (Default: `1`).
* **`contentType`** (`string`, Required): Must be one of `"ESC_POS"`, `"ZPL"`, `"TEXT"`, `"PDF"`, or `"RAW"`.
* **`encoding`** (`string`, Required): Specifying `"BASE64"` tells the agent to unpack string contents into raw, executable terminal instruction byte arrays. Use `"NONE"` for plain ASCII text.
* **`printContent`** (`string`, Required): Your formatted control commands, document payload, or plain text instructions.

---

## 4. Detailed Printing Guide: When, Why & How

### A. ESC/POS (Thermal Receipt & Barcode)
* **When to select**: Use for cash register receipts, retail checkout slips, and printing standalone barcodes on standard 80mm or 58mm thermal rolls.
* **Why to use**: Bypasses slow OS-level print architectures by sending command-level sequences (Esc/Pos protocol tags) directly to printheads in milliseconds.
* **How to verify**: Submit a test payload using `BASE64` encoding. Check agent logs for `EscPosPrinterHandler` orchestration and network dispatch actions.

#### Postman Example JSON (UPC-A Barcode, Centered Alignment, Margin Feeds)
```json
{
  "printerId": "TVS3150",
  "printerType": "ESC_POS",
  "copies": 1,
  "contentType": "ESC_POS",
  "encoding": "BASE64",
  "printContent": "G0AbYQEdaDwddwMdSAAdawAxMjM0NTY3ODkwMTIAChtKUA=="
}
```

---

### B. ZPL (Zebra Programming Language)
* **When to select**: Use for shipping labels, adhesive inventory tags, routing barcodes, and industrial product decals.
* **Why to use**: Standardizes structural vector assets (layout bounding boxes, text frames, line dividers) without raster artifacts.
* **How to verify**: Submit an ASCII string with `NONE` representation. Look for `ZplPrinterHandler` in agent outputs.

#### Postman Example JSON
```json
{
  "printerId": "ZBR-001",
  "printerType": "Zebra",
  "copies": 1,
  "contentType": "ZPL",
  "encoding": "NONE",
  "printContent": "^XA\n^FO50,60^A0N,32,32^FDORDER-ITEM-90184^FS\n^FO50,110^BY2\n^BCN,70,Y,N,N\n^FD90184^FS\n^XZ"
}
```

---

### C. Plain TEXT
* **When to select**: Use for diagnostic logging, basic header outputs, audit trails, and general report logs.
* **Why to use**: Does not require native command syntax. Highly human-readable in development and works across all printer segments out-of-the-box.

#### Postman Example JSON
```json
{
  "printerId": "TVS3150",
  "printerType": "ESC_POS",
  "copies": 1,
  "contentType": "TEXT",
  "encoding": "NONE",
  "printContent": "===========================================\n        INVENTORY DISPATCH SUMMARY\n===========================================\nItem SKU     : INV-ITEM-90184\nQuantity     : 42 Units\nValidation   : Success\n===========================================\n\n\n"
}
```

---

### D. PDF Document Streams
* **When to select**: Standard office forms, full page invoice PDFs, packing lists, and graphical rich envelopes.
* **Why to use**: Preserves document designs, formatting alignments, and signatures regardless of client screen layouts.

#### Postman Example JSON
```json
{
  "printerId": "TVS3150",
  "printerType": "PDF",
  "copies": 1,
  "contentType": "PDF",
  "encoding": "BASE64",
  "printContent": "JVBERi0xLjQKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PgplbmRvYmoKMiAwIG9iagogIDw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbMyAwIFJdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL0BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvUmVzb3VyY2VzIDQgMCBSIC9Db250ZW50cyA1IDAgUiA+PgplbmRvYmoKMyAwIG9iaagogIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PgplbmRvYmoKNSAwIG9iaagogIDw8IC9MZW5ndGggNDQgPj4Kc3RyZWFtCkJUCiAgL0YxIDEyIFRmCiAgNzIgNzEyIFRkCiAgKEhlbGxvLCBXb3JsZCEpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNiAwIG9iaagogIDw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE3IDAwMDAgbiAKMDAwMDAwMDA3OSAwMDAwIG4gCjAwMDAwMDAxMzkgMDAwMCBuIAowMDAwMDAwMjQ0IDAwMDAgbiAKMDAwMDAwMDI5NCAwMDAwIG4gCjAwMDAwMDAzODkgMDAwMCBuIAp0cmFpbGVyCiAgPDwgL1NpemUgNyAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDc0CiUlRU9GCg=="
}
```

---

## 5. How Physical Sizes are Adjusted

Because thermal printers do not understand CSS stylesheets, responsive viewport models, or HTML dimensions, **sizing is configured programmatically via embedded hardware parameters**.

### A. ESC/POS (Thermal Receipt Sizing)
Sizing configurations for ESC/POS are declared inline inside the byte sequence of your base64 payload.

1. **Barcode Height Setting (`GS h [n]`)**:
   * Command: `29, 104, n` (in Hex: `1D 68 n`)
   * Scope: `n` defines the barcode's height in vertical dots (usually $1 \le n \le 255$).
   * *Example*: `29, 104, 60` sets the height to exactly 60 dots (approx. 15mm / 0.6 inches). `29, 104, 120` doubles the physical barcode height to 120 dots (~30mm).

2. **Barcode Module Width (`GS w [n]`)**:
   * Command: `29, 119, n` (in Hex: `1D 77 n`)
   * Scope: `n` sets the width of thin-bar modules. Range is typically `2` to `6` dots wide.
   * *Usage*: In narrower rolls (e.g. 58mm), specify `29, 119, 2` to fit your data. In wider rolls (80mm), use `29, 119, 3` for robust scanning resolutions.

3. **Human-Readable Text (HRI) Positioning (`GS H [n]`)**:
   * Command: `29, 72, n` (in Hex: `1D 48 n`)
   * Scope: Determines where the plain numbers/letters are placed around the barcode:
     * `0`: Do not print numbers (Saves vertical space)
     * `1`: Print above the barcode
     * `2`: Print below the barcode (Default)
     * `3`: Print both above and below the barcode

4. **Paper Feeds & Clearances (`ESC J [n]`)**:
   * Command: `27, 74, n` (in Hex: `1B 4A n`)
   * Scope: Feeds the paper forward by `n` vertical dots. This is critical to advance the printed barcode beyond the physical guillotine cutter without triggering blank pages.
   * *Example*: `27, 74, 80` advances the roll by 80 dots (approx. 10mm) right after print completion.

---

### B. ZPL (Zebra Label Sizing)
Sizing in Zebra ZPL is declared in the command headers using geometric configurations.

1. **Label Boundaries (`^LL` and `^PW`)**:
   * `^PW[width]`: Set width in dots (e.g., `^PW800` for a 4-inch wide label on a 203 DPI printer).
   * `^LL[height]`: Set height/length in dots (e.g., `^LL1200` for a 6-inch label).
   * *Location to modify*: This should always be placed at the top of the ZPL body, directly following `^XA`.

2. **Element Offsets (`^FO`)**:
   * Format: `^FO[x_dots],[y_dots]`
   * *Example*: `^FO50,110` positions the elements 50 dots from the left and 110 dots from the top of the label boundary.

3. **Field Sizing Ratio (`^BY`)**:
   * Command: `^BY[module_width],[ratio],[height]`
   * *Example*: `^BY2,2,70` sets a module width of 2, a wide-to-narrow bar ratio of 2.0, and a default barcode height of 70 dots.

---

### C. Plain TEXT Columns (Monospace Layout)
Maintains horizontal sizing through strict string character alignments:
* **80mm Paper width**: Fits **48 characters** horizontally using default thermal formatting.
* **58mm Paper width**: Fits **32 characters** horizontally.
* *How to adjust layout size*: Use standard programming loops to pad left/right or truncate strings to match hardware limits and prevent unintended carriage wraps.

---

## 6. The "Direct PDF to ESC/POS Thermal Printer" Compatibility Gotcha (CRITICAL)

When you queue a PDF document stream to a terminal thermal printer (such as sending a base64 encoded PDF payload to `TVS3150` with `"printerType": "ESC_POS"` and `"contentType": "PDF"`), you will observe **garbled, unreadable characters (such as `%PDF-1.4...`, `%ReportLab generated...`, binary symbols)** being spit out across feet of thermal paper.

### Why does this happen?
1. **No Native PDF Interpreters**: Standard direct-socket thermal receipt printers (Epson, TVS Electronics, Citizen, Star) do not have embedded microprocessors capable of reading, parsing, or rasterizing the vector shapes, objects, binary compression streams, and font engines packaged inside a complex `.pdf` file.
2. **Direct Byte Pipeline**: Sending a base64 decoded PDF stream over a standard TCP connection (Port 9100) feeds raw binary ascii text straight to the printer's feed. The printer, finding no ESC/POS tags (like standard initialization `ESC @` or center-align `ESC a 1`), interprets every alphanumeric and non-printable binary byte as literal text characters, resulting in garbage prints.

---

## 7. How to Resolve: Standard Patterns for Printing PDFs to Thermal Hardware

If you need to print a formatted invoice PDF (like your `"TESTING IS IMPORTANT"` PDF) to your TVS3150 or Epson thermal receipt printer, you must use one of the two standard commercial integration patterns:

### Pattern A: Client/Sender-Side Rasterization (RECOMMENDED)
Since the printer cannot render the vector PDF file itself, the server-side ERP or client application must do the render work beforehand!
1. **Render PDF to Bitmap**: Use an open-source library on your server or client terminal (such as `Ghostscript`, `PDFSharp`, `SkiaSharp`, or a Node utility like `pdfjs-dist` or `pdf-to-printer`) to render pages of the PDF file into a black-and-white (1-bit monochrome) graphic image of proportional horizontal resolution (matching your target roll size):
   * **80mm Paper roll**: Render the image exactly **576 pixels wide**.
   * **58mm Paper roll**: Render the image exactly **384 pixels wide**.
2. **Convert Bitmap to ESC/POS Commands**: Map the monochrome pixels into standard ESC/POS graphics binary codes using the bit-image printer commands:
   * **`GS v 0`** (Print Raster Bit Image): Outlines precise binary bitmasks line-by-line.
   * **`ESC *`** (Select Bit-Image Mode): Older standard command layout.
3. **Queue as ESC_POS / RAW**: Pass this processed graphics command buffer (encoded in `BASE64`) to the queue under **`contentType: "ESC_POS"`** or **`contentType: "RAW"`**. This renders drawing lines, text shapes, logos, and layouts perfectly!

### Pattern B: Windows Driver Spooler-Side Rendering (Easiest for Local Client PCs)
Instead of feeding raw bytes to a direct network socket bypass (Port 9100), configure the print agent to interface with the local system's **operating system print queue** where the printer driver is installed:
1. Register your physical printer as a local/network share print device in Windows.
2. In your print request payload, specify **`"printerType": "WindowsPrinter"`** and **`"contentType": "PDF"`**.
3. The Universal Print Agent's `WindowsPrinterConnector` uses the Windows GDI Spooler API. It hands the PDF file cleanly over to the OS. The TVS/Epson Windows Printer Driver then handles the scaling, anti-aliasing, layout fitting, and rasterization automatically before transferring the printhead instructions. 

---

## 8. Verification Checklist & Troubleshooting

To verify and test your setup, perform the following structural steps:

1. **Endpoint Access**: Verify that your Central API is running (typically bound to `http://localhost:3000`).
2. **Device Registration check**: Ensure your agent has checked in and has its `type` set correctly to `"ESC_POS"` or `"Zebra"` instead of generic string matches.
3. **Payload Test (Postman)**:
   * Select a Postman POST to your central jobs endpoint.
   * Set headers to `Content-Type: application/json`.
   * Submit the Base64 ESC/POS payload or plain text ZPL.
4. **Checking Agent System Outputs**:
   Verify correct strategy mapping via agent logs:
   * **Base64 Decode Verification**:
     `EscPosPrinterHandler: Decoding Base64 formatted raw byte array`
   * **TCP Broadcast Verification**:
     `TCP socket broadcast started: Sending X raw bytes to printer at 127.0.0.1:9100`

This ensures full-pipeline communication from ERP payload definitions directly to hardware thermal output with exact millimetric dimensions!
