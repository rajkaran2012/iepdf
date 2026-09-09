export interface SecurityValidationResult {

    readonly passwordProtected: boolean;

    readonly encrypted: boolean;

    readonly hasJavaScript: boolean;

    readonly hasLaunchAction: boolean;

    readonly hasEmbeddedFiles: boolean;

    readonly embeddedFileCount: number;

    readonly hasMalwarePatterns: boolean;

    readonly detectedMalwarePatterns: readonly string[];

}

export interface ISecurityValidator {

    validate(
        file: File
    ): Promise<SecurityValidationResult>;

}