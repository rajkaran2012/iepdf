/**
 * =============================================================================
 * iePDF Browser Engine
 * =============================================================================
 *
 * File        : validationUtils.ts
 * Module      : Validation Engine
 * Layer       : Common
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Shared utility functions used throughout the Validation Engine.
 *
 * This file contains ONLY reusable, pure helper functions.
 *
 * DO NOT:
 * • Access React
 * • Access UI Components
 * • Parse PDFs
 * • Perform Validation Logic
 * • Read Browser Configuration
 *
 * =============================================================================
 */

import { ValidationException } from "./validationException";

/**
 * Validation Utility Class
 *
 * Static only.
 */
export class ValidationUtils {

    /**
     * Prevent instantiation.
     */
    private constructor() {
        throw new ValidationException({
            message: "ValidationUtils cannot be instantiated."
        });
    }

    /**
     * Format bytes into a readable string.
     *
     * Example:
     * 1024 -> 1 KB
     * 1048576 -> 1 MB
     */
    static formatBytes(bytes: number): string {

        if (!Number.isFinite(bytes) || bytes < 0) {
            return "0 Bytes";
        }

        if (bytes === 0) {
            return "0 Bytes";
        }

        const units = [
            "Bytes",
            "KB",
            "MB",
            "GB",
            "TB"
        ];

        const index = Math.floor(Math.log(bytes) / Math.log(1024));

        const value = bytes / Math.pow(1024, index);

        return `${value.toFixed(2)} ${units[index]}`;
    }

    /**
     * Normalize filename.
     *
     * Removes surrounding whitespace.
     */
    static normalizeFilename(fileName: string): string {

        return fileName.trim();
    }

    /**
     * Extract file extension.
     *
     * Returns lowercase extension.
     *
     * Example:
     * report.PDF -> pdf
     */
    static getExtension(fileName: string): string {

        const index = fileName.lastIndexOf(".");

        if (index < 0) {
            return "";
        }

        return fileName
            .substring(index + 1)
            .trim()
            .toLowerCase();
    }

    /**
     * Determine if filename has an extension.
     */
    static hasExtension(fileName: string): boolean {

        return this.getExtension(fileName).length > 0;
    }

    /**
     * Safely compare two strings.
     */
    static equalsIgnoreCase(
        first: string,
        second: string
    ): boolean {

        return first.localeCompare(
            second,
            undefined,
            {
                sensitivity: "accent"
            }
        ) === 0;
    }

    /**
     * Create a high precision timestamp.
     */
    static now(): number {

        return performance.now();
    }

    /**
     * Calculate execution time.
     */
    static elapsed(start: number): number {

        return performance.now() - start;
    }

    /**
     * Create immutable metadata.
     */
    static freezeMetadata<T extends Record<string, unknown>>(metadata: T): Readonly<T> {

        return Object.freeze({ ...metadata });
    }

    /**
     * Determine whether a string is empty.
     */
    static isBlank(value: string | null | undefined): boolean {

        return value == null || value.trim().length === 0;
    }

    /**
     * Clamp a numeric value.
     */
    static clamp(
        value: number,
        minimum: number,
        maximum: number
    ): number {

        return Math.min(
            Math.max(value, minimum),
            maximum
        );
    }

    /**
    * Safely convert unknown to Error
   */
static toError(error: unknown): Error {

        if (error instanceof Error) {
            return error;
        }

        if (typeof error === "string") {
            return new Error(error);
        }

        return new Error(String(error));

    }

}