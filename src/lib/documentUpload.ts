const SCAN_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".dot",
  ".dotx",
  ".rtf",
  ".odt",
  ".ppt",
  ".pptx",
  ".pot",
  ".potx",
  ".ppa",
  ".pps",
  ".ppsx",
  ".pwz",
  ".wiz",
  ".xls",
  ".xlsx",
  ".xla",
  ".xlb",
  ".xlc",
  ".xlm",
  ".xlt",
  ".xlw",
  ".csv",
  ".tsv",
  ".iif",
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".html",
  ".htm",
  ".xml",
  ".eml",
  ".mht",
  ".mhtml",
  ".ics",
  ".vcf",
  ".log",
  ".pages",
  ".numbers",
  ".key",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

const SCAN_DOCUMENT_MIME_TYPES = new Set([
  "application/json",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.apple.iwork",
  "application/vnd.apple.keynote",
  "application/vnd.apple.numbers",
  "application/vnd.apple.pages",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.template",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/xml",
  "application/x-iif",
  "message/rfc822",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/rtf",
  "text/tab-separated-values",
  "text/calendar",
  "text/tsv",
  "text/vcard",
  "text/xml",
]);

export const SCAN_DOCUMENT_ACCEPT = SCAN_DOCUMENT_EXTENSIONS.join(",");
export const SCAN_DOCUMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;

function getExtension(fileName: string): string {
  const extension = fileName.split(".").pop()?.trim().toLowerCase();
  return extension ? `.${extension}` : "";
}

export function isAcceptedScanDocument(file: File): boolean {
  const mimeType = file.type.split(";")[0].trim().toLowerCase();
  return (
    (mimeType.length > 0 && SCAN_DOCUMENT_MIME_TYPES.has(mimeType)) ||
    SCAN_DOCUMENT_EXTENSIONS.includes(getExtension(file.name) as typeof SCAN_DOCUMENT_EXTENSIONS[number])
  );
}
