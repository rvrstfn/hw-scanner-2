import {
  readBarcodesFromImageFile,
  defaultZXingReadOptions,
  setZXingModuleOverrides,
} from "@sec-ant/zxing-wasm";

const formats = ["qr_code", "code_128", "code_39", "data_matrix"];

export const onRequestPost = async ({ request }) => {
  try {
    setZXingModuleOverrides({
      locateFile(path) {
        if (path.endsWith(".wasm")) {
          return new URL(`/vendor/zxing/${path}`, request.url).href;
        }
        return path;
      },
    });

    const form = await request.formData();
    const file = form.get("image");
    if (!file || typeof file.arrayBuffer !== "function") {
      return jsonResponse({ error: "Missing image upload" }, 400);
    }

    const results = await readBarcodesFromImageFile(file, {
      ...defaultZXingReadOptions,
      tryHarder: true,
      formats,
    });

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
