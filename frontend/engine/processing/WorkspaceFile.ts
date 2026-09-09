/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : WorkspaceFile.ts
 * Module     : Processing
 * Layer      : Context
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Represents one PDF inside the Merge Workspace.
 *
 * This is the single source of truth for every file throughout the
 * complete processing pipeline.
 *
 * UI, Analyzer and Processor all operate on this object.
 * =============================================================================
 */

export type WorkspaceFileStatus =
    | "ready"
    | "password_required"
    | "corrupted";

export interface WorkspaceFile {

    /**
     * Unique identifier.
     */
    readonly id: string;

    /**
     * Original browser File.
     */
    readonly file: File;

    /**
     * Display filename.
     */
    readonly filename: string;

    /**
     * File extension.
     */
    readonly extension: string;

    /**
     * File size in bytes.
     */
    readonly size: number;

    /**
     * Number of pages.
     */
    readonly pages: number;

    /**
     * Current workspace status.
     */
    readonly status: WorkspaceFileStatus;

    /**
     * True if encrypted.
     */
    readonly encrypted: boolean;

    /**
     * True if corrupted.
     */
    readonly corrupted: boolean;

    /**
     * User entered password.
     */
    readonly password: string;

    /**
     * Password visibility.
     */
    readonly showPassword: boolean;

    /**
     * Skip this file during processing.
     */
    readonly skipped: boolean;

    /**
     * Optional informational message.
     */
    readonly message?: string;
}