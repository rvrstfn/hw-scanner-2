import employees from "../../data/employees.json" assert { type: "json" };

export const onRequestGet = () =>
  new Response(JSON.stringify({ employees }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
