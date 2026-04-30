export function checkAdminAuth(req) {
  const header = req.headers.get("x-admin-auth") || "";
  if (!header) return false;
  const legacy = process.env.ADMIN_PASSWORD;
  const p1 = process.env.ADMIN_PASS_DHANANJAY;
  const p2 = process.env.ADMIN_PASS_SHISHIR;
  return (
    (legacy && header === legacy) ||
    (p1 && header === p1) ||
    (p2 && header === p2)
  );
}
