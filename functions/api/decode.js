import {
  readBarcodesFromImageFile,
  defaultZXingReadOptions,
  setZXingModuleOverrides,
} from "@sec-ant/zxing-wasm";

const formats = ["qr_code", "code_128", "code_39", "data_matrix"];

export const onRequestPost = async ({ request }) => {
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!file || typeof file.arrayBuffer !== "function") {
      return jsonResponse({ error: "Missing image upload" }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return jsonResponse({ error: "Empty image" }, 400);
    }

    setZXingModuleOverrides({
      locateFile: (path) => new URL(`/vendor/${path}`, request.url).toString(),
    });

    const results = await readBarcodesFromImageFile(
      new Uint8Array(arrayBuffer),
      {
        ...defaultZXingReadOptions,
        tryHarder: true,
        formats,
      }
    );

    const decoded = (results || []).map((item) => ({
      format: item.format,
      text: item.text,
    }));

    if (!decoded.length) {
      return jsonResponse({ decoded: [] }, 200);
    }

    return jsonResponse({ decoded }, 200);
  } catch (error) {
    console.error("Decode failed", error);
    return jsonResponse({ error: "Decode failed" }, 500);
  }
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
