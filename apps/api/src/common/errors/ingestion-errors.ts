import { HttpException, HttpStatus } from '@nestjs/common';

type ErrorContext = Record<string, unknown>;

export class IngestionError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly context?: ErrorContext,
  ) {
    super({ code, message, context, timestamp: new Date().toISOString() }, status);
  }
}

export class InvalidUploadException extends IngestionError {
  constructor(message: string, context?: ErrorContext) {
    super('INVALID_UPLOAD', message, HttpStatus.BAD_REQUEST, context);
  }
}

export class MissingRequiredCsvException extends IngestionError {
  constructor(fileName: string) {
    super(
      'MISSING_REQUIRED_CSV',
      `Le fichier ${fileName} est absent du zip`,
      HttpStatus.BAD_REQUEST,
      { fileName },
    );
  }
}

export class UnknownMadesNamespaceException extends IngestionError {
  constructor(namespace: string | null) {
    super(
      'UNKNOWN_MADES_NAMESPACE',
      `Namespace XML MADES inconnu ou absent`,
      HttpStatus.BAD_REQUEST,
      { namespace },
    );
  }
}

export class PayloadTooLargeException extends IngestionError {
  constructor(sizeBytes: number) {
    super(
      'PAYLOAD_TOO_LARGE',
      `Fichier zip trop volumineux (> 50 MB)`,
      HttpStatus.PAYLOAD_TOO_LARGE,
      { sizeBytes },
    );
  }
}

export class SnapshotNotFoundException extends IngestionError {
  constructor(snapshotId: string) {
    super(
      'SNAPSHOT_NOT_FOUND',
      `Snapshot ${snapshotId} introuvable`,
      HttpStatus.NOT_FOUND,
      { snapshotId },
    );
  }
}
