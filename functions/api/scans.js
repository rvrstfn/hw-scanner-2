export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const employeeFilter = url.searchParams.get("employee");
  let statement = env.DB.prepare(
    "SELECT created_at, employee, qr_data, barcode_data, extra FROM scans ORDER BY created_at DESC"
  );

  if (employeeFilter) {
    statement = env.DB.prepare(
      "SELECT created_at, employee, qr_data, barcode_data, extra FROM scans WHERE employee = ? ORDER BY created_at DESC"
    ).bind(employeeFilter);
  }

  try {
    const { results } = await statement.all();
    const items = results.map((row) => {
      let extra = undefined;
      if (row.extra) {
        try {
          extra = JSON.parse(row.extra);
        } catch {
          extra = row.extra;
        }
      }
      return {
        timestamp: row.created_at,
        employee: row.employee,
        qrData: row.qr_data,
        barcodeData: row.barcode_data,
        ...(extra !== undefined ? { extra } : {}),
      };
    });

    return new Response(JSON.stringify({ items }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("D1 query failed", error);
    return new Response(JSON.stringify({ error: "Failed to load scans" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
};
