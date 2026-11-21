import { describe, expect, it } from "vitest";
import {
    PDFArray,
    PDFDict,
    PDFDocument,
    PDFName,
} from "pdf-lib";

import { LaunchActionDetector } from "./launchActionDetector";

async function createPdf(
    actionType?: "Launch" | "URI" | "GoTo",
    compressed = false
): Promise<File> {

    const document = await PDFDocument.create();
    const page = document.addPage();

    if (actionType === "Launch" || actionType === "URI") {

        const action = PDFDict.withContext(document.context);

        action.set(
            PDFName.of("S"),
            PDFName.of(actionType)
        );

        if (actionType === "Launch") {
            action.set(
                PDFName.of("F"),
                document.context.obj("calc.exe")
            );
        } else {
            action.set(
                PDFName.of("URI"),
                document.context.obj("https://example.com")
            );
        }

        const actionRef = document.context.register(action);

        document.catalog.set(
            PDFName.of("OpenAction"),
            actionRef
        );
    }

    if (actionType === "GoTo") {

        const destination = PDFArray.withContext(document.context);

        destination.push(page.ref);
        destination.push(PDFName.of("Fit"));

        document.catalog.set(
            PDFName.of("OpenAction"),
            destination
        );
    }

    const bytes = await document.save({
        useObjectStreams: compressed,
    });

    const fileBytes = new Uint8Array(bytes.length);
    fileBytes.set(bytes);

    return new File(
        [fileBytes.buffer],
        "security-test.pdf",
        { type: "application/pdf" }
    );
}

describe("LaunchActionDetector", () => {

    const detector = new LaunchActionDetector();

    it("accepts a normal page-opening destination", async () => {
        const file = await createPdf("GoTo");

        await expect(detector.detect(file)).resolves.toEqual({
            hasLaunchActions: false,
        });
    });

    it("accepts an ordinary URI hyperlink", async () => {
        const file = await createPdf("URI");

        await expect(detector.detect(file)).resolves.toEqual({
            hasLaunchActions: false,
        });
    });

    it("detects a genuine Launch action", async () => {
        const file = await createPdf("Launch");

        await expect(detector.detect(file)).resolves.toEqual({
            hasLaunchActions: true,
        });
    });

    it("detects a Launch action inside compressed object streams", async () => {
        const file = await createPdf("Launch", true);

        await expect(detector.detect(file)).resolves.toEqual({
            hasLaunchActions: true,
        });
    });


    it("ignores an unrelated dictionary containing a Launch name", async () => {
        const document = await PDFDocument.create();

        const unrelatedDictionary = PDFDict.withContext(document.context);
        unrelatedDictionary.set(PDFName.of("S"), PDFName.of("Launch"));
        unrelatedDictionary.set(PDFName.of("F"), document.context.obj("calc.exe"));

        document.catalog.set(
            PDFName.of("CustomData"),
            document.context.register(unrelatedDictionary)
        );

        const bytes = await document.save();
        const file = new File(
            [new Uint8Array(bytes)],
            "unrelated-dictionary-test.pdf",
            { type: "application/pdf" }
        );

        await expect(detector.detect(file)).resolves.toEqual({
            hasLaunchActions: false,
        });
    });
});
