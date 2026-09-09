/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : SecurityValidator.ts
 * Module     : Security
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Executes all security detectors and produces a single consolidated
 * security validation result.
 * =============================================================================
 */

import type { ISecurityValidator } from "./interfaces/ISecurityValidator";

import type { IPasswordDetector } from "./interfaces/IPasswordDetector";
import type { IEncryptionDetector } from "./interfaces/IEncryptionDetector";
import type { IJavaScriptDetector } from "./interfaces/IJavaScriptDetector";
import type { ILaunchActionDetector } from "./interfaces/ILaunchActionDetector";
import type { IEmbeddedFileDetector } from "./interfaces/IEmbeddedFileDetector";
import type { IMalwarePatternDetector } from "./interfaces/IMalwarePatternDetector";

import type {
    SecurityValidationResult
} from "./interfaces/ISecurityValidator";

export class SecurityValidator
implements ISecurityValidator {

    public constructor(

        private readonly passwordDetector:
            IPasswordDetector,

        private readonly encryptionDetector:
            IEncryptionDetector,

        private readonly javaScriptDetector:
            IJavaScriptDetector,

        private readonly launchActionDetector:
            ILaunchActionDetector,

        private readonly embeddedFileDetector:
            IEmbeddedFileDetector,

        private readonly malwarePatternDetector:
            IMalwarePatternDetector

    ) {
    }

    public async validate(
        file: File
    ): Promise<SecurityValidationResult> {


         const passwordResult =
            await this.passwordDetector.detect(file);

          const encryptionResult =
            await this.encryptionDetector.detect(file);

         const javaScriptResult =
           await this.javaScriptDetector.detect(file);

         const launchActionResult =
           await this.launchActionDetector.detect(file);

         const embeddedFileResult =
          await this.embeddedFileDetector.detect(file);

        const malwarePatternResult =
          await this.malwarePatternDetector.detect(file);

return {

    passwordProtected:
        passwordResult.isPasswordProtected,

    encrypted:
        encryptionResult.encrypted,

    hasJavaScript:
        javaScriptResult.hasJavaScript,

    hasLaunchAction:
        launchActionResult.hasLaunchActions,

    hasEmbeddedFiles:
        embeddedFileResult.hasEmbeddedFiles,

    embeddedFileCount:
        embeddedFileResult.fileCount,

    hasMalwarePatterns:
        malwarePatternResult.hasMalwarePatterns,

    detectedMalwarePatterns:
        malwarePatternResult.detectedPatterns
};

    }

}