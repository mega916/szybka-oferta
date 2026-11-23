# Szybka Oferta

Generator ofert dla małych firm usługowych i wykonawczych (9 branż do wyboru) + strona sprzedażowa. Czysty HTML/CSS/JS, bez serwera. Dane użytkownika zostają w jego przeglądarce.

- `index.html` — strona sprzedażowa
- `generator.html`, `app.js`, `app.css` — generator ofert
- `style.css` — wygląd strony sprzedażowej
- `config.js` — cena, e-mail, link do płatności, kody Pro

## Publikacja (GitHub Pages)
Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`. Strona będzie pod `https://<login>.github.io/szybka-oferta/`.

## Ustawienia w `config.js`
- `checkoutUrl` — link do płatności (Naffy/Gumroad). Puste = przycisk „Kup” otwiera e-mail.
- `price` — cena wyświetlana na stronie.

## Nowy kod Pro
Wygeneruj kod i jego skrót, a skrót dopisz do `licenseHashes`:

    node -e "const c='SO-'+require('crypto').randomBytes(5).toString('hex').toUpperCase();console.log(c,require('crypto').createHash('sha256').update(c).digest('hex'))"

Kod wysyłasz klientowi, skrót wpisujesz w `config.js`. To zabezpieczenie „miękkie” (działa w przeglądarce, da się je obejść), wystarczy do sprzedaży małego narzędzia.
