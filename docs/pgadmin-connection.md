# pgAdmin 4 — connect to this project’s Postgres

Use these values after you start the stack (`docker-compose.yml`):  
**pgAdmin (web):** http://127.0.0.1:5050  

Sign in with the pgAdmin account from Compose:

| Field | Value |
|--------|--------|
| **Email** | `admin@fitandsleek.com` |
| **Password** | `admin123` |

---

## Register a server (inside web pgAdmin)

1. Right-click **Servers** → **Register** → **Server…**
2. **General** tab: **Name** — e.g. `Fit and Sleek (Docker)`
3. **Connection** tab — use the table below (depends where pgAdmin runs).

### pgAdmin runs in Docker (`fitandsleek_pgadmin`)

pgAdmin and Postgres share the same Compose network. The database hostname is the **service name** `db`, not `pgsql` or `localhost`.

| Field | Value |
|--------|--------|
| **Host name/address** | `db` |
| **Port** | `5432` |
| **Maintenance database** | Same as `DB_DATABASE` in `backend/.env` (e.g. `fitandsleek_v2` or `fitandsleek_v3`) |
| **Username** | `postgres` |
| **Password** | `Norng@123` (same as `POSTGRES_PASSWORD` in `docker-compose.yml`) |

Enable **Save password** if you want.

---

### pgAdmin 4 Desktop (installed on your Mac)

Traffic goes from your Mac to the published Postgres port.

| Field | Value |
|--------|--------|
| **Host name/address** | `127.0.0.1` or `localhost` |
| **Port** | `5433` (see `ports` on the `db` service in `docker-compose.yml`; host port maps to 5432 inside Docker) |
| **Maintenance database** | Same as `DB_DATABASE` in `backend/.env` (e.g. `fitandsleek_v2` or `fitandsleek_v3`) |
| **Username** | `postgres` |
| **Password** | `Norng@123` |

If port `5432` is already used on your machine, change the left side of the port mapping in Compose (e.g. `5433:5432`) and use that **host** port in pgAdmin instead.

---

## SSL

For local Docker, **SSL mode** can stay **Prefer** or **Disable** unless you configure TLS on Postgres.

---

## Quick reference

| Item | Value |
|------|--------|
| App database | Same as `DB_DATABASE` in `backend/.env` |
| Postgres container | `fitandsleek_db` |
| Compose service name (host from pgAdmin container) | `db` |
