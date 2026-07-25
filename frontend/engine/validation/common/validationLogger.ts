/**
 * =============================================================================
 * iePDF Browser Engine
 * =============================================================================
 *
 * File        : validationLogger.ts
 * Module      : Validation Engine
 * Layer       : Common
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Centralized logger for the Validation Engine.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Structured logging
 * ✓ Debug logging
 * ✓ Performance logging
 * ✓ Error logging
 * ✓ Group logging
 * ✓ Production safe
 * ✓ Browser First
 *
 * -----------------------------------------------------------------------------
 * IMPORTANT
 * -----------------------------------------------------------------------------
 * Validators MUST NEVER use:
 *
 * console.log()
 * console.error()
 * console.warn()
 *
 * Always use ValidationLogger.
 *
 * =============================================================================
 */

export enum ValidationLogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
}

export interface ValidationLogEntry {

    readonly timestamp: Date;

    readonly level: ValidationLogLevel;

    readonly source: string;

    readonly message: string;

    readonly metadata?: Readonly<Record<string, unknown>>;
}

export class ValidationLogger {

    /**
     * Enable/Disable logging.
     *
     * Later this will come from Feature Flags.
     */
    private static enabled = true;

    /**
     * Enable Logger
     */
    static enable(): void {
        this.enabled = true;
    }

    /**
     * Disable Logger
     */
    static disable(): void {
        this.enabled = false;
    }

    /**
     * Debug
     */
    static debug(
        source: string,
        message: string,
        metadata?: Readonly<Record<string, unknown>>
    ): void {

        if (!this.enabled) return;

        console.debug({
            timestamp: new Date(),
            level: ValidationLogLevel.DEBUG,
            source,
            message,
            metadata,
        } satisfies ValidationLogEntry);
    }

    /**
     * Information
     */
    static info(
        source: string,
        message: string,
        metadata?: Readonly<Record<string, unknown>>
    ): void {

        if (!this.enabled) return;

        console.info({
            timestamp: new Date(),
            level: ValidationLogLevel.INFO,
            source,
            message,
            metadata,
        } satisfies ValidationLogEntry);
    }

    /**
     * Warning
     */
    static warn(
        source: string,
        message: string,
        metadata?: Readonly<Record<string, unknown>>
    ): void {

        if (!this.enabled) return;

        console.warn({
            timestamp: new Date(),
            level: ValidationLogLevel.WARN,
            source,
            message,
            metadata,
        } satisfies ValidationLogEntry);
    }

    /**
     * Error
     */
    static error(
        source: string,
        message: string,
        error?: unknown,
        metadata?: Readonly<Record<string, unknown>>
    ): void {

        if (!this.enabled) return;

        console.error({
            timestamp: new Date(),
            level: ValidationLogLevel.ERROR,
            source,
            message,
            error,
            metadata,
        });
    }

    /**
     * Start Console Group
     */
    static group(title: string): void {

        if (!this.enabled) return;

        console.group(title);
    }

    /**
     * End Console Group
     */
    static groupEnd(): void {

        if (!this.enabled) return;

        console.groupEnd();
    }

    /**
     * Performance Timer Start
     */
    static time(label: string): void {

        if (!this.enabled) return;

        console.time(label);
    }

    /**
     * Performance Timer End
     */
    static timeEnd(label: string): void {

        if (!this.enabled) return;

        console.timeEnd(label);
    }
}

export default ValidationLogger;