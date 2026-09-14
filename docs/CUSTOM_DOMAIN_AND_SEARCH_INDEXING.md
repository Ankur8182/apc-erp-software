# Custom Domain and Search Indexing

## Purpose and safety boundary

AP Construction ERP is an authenticated business application. The only page intentionally presented to search engines is the public root/login entry:

```text
https://a-p-construction-erp.web.app/
```

The public entry describes A P Construction and AP Construction ERP without exposing company records, user information, financial data, or operational data. Authenticated ERP routes are not included in the sitemap, are disallowed in `public/robots.txt`, and receive an `X-Robots-Tag: noindex, nofollow, noarchive` response header through `firebase.json` after an approved Hosting deployment.

Robots directives are crawl guidance, not access control. Firebase Authentication, route protection, Firestore rules, and role authorization remain the actual protection for ERP data.

## Current public SEO files

| File | Purpose |
| --- | --- |
| `public/index.html` | Public title, description, canonical URL, application name, and Open Graph metadata. |
| `public/robots.txt` | Allows the public root while discouraging crawlers from protected ERP paths; it also advertises the sitemap. |
| `public/sitemap.xml` | Lists only the public root URL. Never add authenticated ERP routes. |
| `firebase.json` | Sends a server-side `X-Robots-Tag` noindex header for known protected application paths before the SPA rewrite is applied. |

## Google Search Console: current Firebase Hosting URL

1. Sign in to [Google Search Console](https://search.google.com/search-console/).
2. Add a **URL-prefix** property using the exact value `https://a-p-construction-erp.web.app/`, including the protocol and trailing slash.
3. Complete one of the ownership-verification methods offered by Google for that property. Do not use another person's account or publish a token you do not control.
4. After verification, open **Sitemaps** and submit `https://a-p-construction-erp.web.app/sitemap.xml`.
5. Use URL Inspection for `https://a-p-construction-erp.web.app/` and choose **Request indexing** if the page is eligible.
6. Monitor the sitemap and Page Indexing reports. Sitemap submission and Request Indexing are requests, not a guarantee or an immediate publication in Google Search.

Google may offer an HTML meta-tag verification method. If that method is chosen, paste the real, Google-issued tag inside the `<head>` of `public/index.html`, next to the existing metadata, then build and make an approved Hosting deployment. Do not commit a placeholder, invented value, or another party's verification token.

## Future custom-domain procedure

Do not purchase, assume, or hard-code a domain name in source control. Once the organization has selected and controls a domain:

1. In Firebase Console, open **Hosting**, select the correct Hosting site, and choose **Add custom domain**.
2. Enter the organization-owned domain and follow the Firebase wizard exactly. Firebase supplies the ownership TXT record and the DNS record values; do not reuse values from documentation or another project.
3. Add the supplied DNS records at the domain registrar/DNS provider. Keep required ownership records in place. If the domain already serves traffic, use Firebase's migration guidance rather than redirecting traffic prematurely.
4. Wait for DNS propagation and Firebase SSL certificate provisioning. Verify that the domain status is **Connected** and HTTPS is valid before treating it as production-ready.
5. Update all public canonical locations to the approved HTTPS custom-domain root:
   - `public/index.html`: canonical URL and `og:url`.
   - `public/robots.txt`: `Sitemap` URL.
   - `public/sitemap.xml`: the sole `<loc>` URL.
6. Build, review, and deploy Hosting only through the approved release process. Do not alter Firestore, Storage, or Functions merely to connect a domain.
7. Add the exact HTTPS custom-domain root as a new Search Console URL-prefix property, verify ownership, submit its sitemap, and request indexing of only its public root.
8. Keep one canonical public domain. Configure redirects in the Firebase custom-domain flow as appropriate so duplicate apex/`www` variants are not promoted as separate content.

Firebase Hosting provisions SSL certificates for connected custom domains. DNS and certificate timing vary; follow the current Firebase console prompts rather than copying static record values.

## Safe verification after an approved Hosting deployment

Check the following without signing in:

```text
https://<approved-domain>/
https://<approved-domain>/robots.txt
https://<approved-domain>/sitemap.xml
```

- The root shows the public A P Construction ERP login entry, title, description, and canonical URL.
- `robots.txt` names the correct sitemap and lists protected routes as disallowed.
- `sitemap.xml` is valid XML and lists only the public root.
- A direct request to a known protected route keeps its normal authentication behavior and includes `X-Robots-Tag: noindex, nofollow, noarchive` after Hosting configuration is deployed.
- No sitemap, metadata, preview, or Search Console action exposes private ERP records.

## References

- [Firebase Hosting: connect a custom domain](https://firebase.google.com/docs/hosting/custom-domain)
- [Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config)
- [Google Search Console URL-prefix properties](https://support.google.com/webmasters/answer/10432366)
- [Google Search Console ownership verification](https://support.google.com/webmasters/answer/9008080)
- [Google Search Console Sitemaps report](https://support.google.com/webmasters/answer/7451001)
- [Google Search Console URL Inspection](https://support.google.com/webmasters/answer/9012289)