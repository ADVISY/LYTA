const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  dot: "application/msword",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  eml: "message/rfc822",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  ics: "text/calendar",
  iif: "application/x-iif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  key: "application/vnd.apple.keynote",
  log: "text/plain",
  markdown: "text/markdown",
  md: "text/markdown",
  mht: "message/rfc822",
  mhtml: "message/rfc822",
  numbers: "application/vnd.apple.numbers",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
  pages: "application/vnd.apple.pages",
  pdf: "application/pdf",
  png: "image/png",
  pot: "application/vnd.ms-powerpoint",
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template",
  ppa: "application/vnd.ms-powerpoint",
  pps: "application/vnd.ms-powerpoint",
  ppsx: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pwz: "application/vnd.ms-powerpoint",
  rtf: "application/rtf",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  vcf: "text/vcard",
  webp: "image/webp",
  wiz: "application/vnd.ms-powerpoint",
  xls: "application/vnd.ms-excel",
  xla: "application/vnd.ms-excel",
  xlb: "application/vnd.ms-excel",
  xlc: "application/vnd.ms-excel",
  xlm: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlt: "application/vnd.ms-excel",
  xlw: "application/vnd.ms-excel",
  xml: "application/xml",
};

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.trim().toLowerCase() || "";
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim() || "document";
}

export function normalizeDocumentMimeType(fileName: string, mimeType?: string | null): string {
  const normalizedMimeType = typeof mimeType === "string"
    ? mimeType.split(";")[0].trim().toLowerCase()
    : "";

  if (
    normalizedMimeType &&
    normalizedMimeType !== "application/octet-stream" &&
    normalizedMimeType !== "binary/octet-stream" &&
    normalizedMimeType !== "batch"
  ) {
    return normalizedMimeType;
  }

  return MIME_TYPES_BY_EXTENSION[getFileExtension(fileName)] || "application/octet-stream";
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function buildChatDocumentContent(file: {
  fileName: string;
  mimeType?: string | null;
  base64: string;
}): Record<string, unknown> {
  const mimeType = normalizeDocumentMimeType(file.fileName, file.mimeType);
  const dataUrl = `data:${mimeType};base64,${file.base64}`;

  if (isImageMimeType(mimeType)) {
    return {
      type: "image_url",
      image_url: {
        url: dataUrl,
      },
    };
  }

  return {
    type: "file",
    file: {
      filename: sanitizeFileName(file.fileName),
      file_data: dataUrl,
    },
  };
}
