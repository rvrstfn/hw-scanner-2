export const onRequestPost = async ({ request, env }) => {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const employee = (payload?.employee || "").trim();
  if (!employee) {
    return jsonResponse({ error: "Employee is required" }, 400);
  }

  const qrData = payload?.qrData ?? null;
  const barcodeData = payload?.barcodeData ?? null;
  const extra = Object.fromEntries(
    Object.entries(payload || {}).filter(
      ([key]) => !["employee", "qrData", "barcodeData"].includes(key)
    )
  );

  const timestamp = new Date().toISOString();

  try {
    await env.DB.prepare(
      "INSERT INTO scans (created_at, employee, qr_data, barcode_data, extra) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(timestamp, employee, qrData, barcodeData, JSON.stringify(extra))
      .run();
  } catch (error) {
    console.error("D1 insert failed", error);
    return jsonResponse({ error: "Failed to store scan" }, 500);
  }

  return jsonResponse({ status: "stored" });
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
