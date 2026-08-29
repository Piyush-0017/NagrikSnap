# TODO - Improve quality of all features

## Backend
1. [x] Fix /auth/login to verify registered admins (DB) via verify_password + env fallback
2. [x] Make init_db() explicit on startup
3. [x] Ensure /auth/me returns usable user details

## Frontend backend-integration
4. [ ] admin.html: load from backend GET /complaints (JWT) w/ local fallback + escape content
5. [ ] track.html: try backend GET /complaints/{id} first, fallback local + escape
6. [ ] my-complaints.html: try backend by phone, fallback local + escape

## i18n completeness
7. [ ] Add missing i18n keys (admin/track/login/my-complaints/reviews) across 7 langs
8. [ ] Wire data-i18n to hardcoded strings on those pages

## UX & robustness
9. [ ] report.html: reset submit button on backend failure + inline error
10. [ ] Consistent loading/empty/error states

## CSS / dark-mode polish
11. [x] Add dark-mode rules for my-complaints empty-box, admin filters, hardcoded-light elements
