# Chrome Web Store listing copy

## English listing

Name: **Homing - bookmark sorter**

Summary: Sort bookmarks from one Inbox into folders you choose.

Description:

Bookmarks that find their own way home.

Homing sorts bookmarks arriving directly in one Inbox folder you choose.
Create simple rules based on domains, URLs, or words in bookmark titles, and
choose where each rule sends them. Bookmarks saved anywhere else stay where
you put them.

- Choose your own Inbox and destinations.
- Match domains, subdomains, URL patterns, and title keywords.
- Arrange rules in order: the first enabled match wins.
- Leave uncertain matches in the Inbox for you to sort.
- See recent decisions and undo a successful automatic move within 10 minutes.
- Keep newer manual moves authoritative.
- Use the interface in English or Polish.

Homing processes bookmark data locally. It has no analytics, remote
classification, or access to page content. Browser bookmark synchronization
continues to work under your browser's own settings.

Questions or ideas? Use Send feedback in settings or the popup to email
damian@warna.pl. No bookmark data is automatically included.

## Polish listing

Nazwa: **Homing - sortowanie zakładek**

Podsumowanie: Sortuj zakładki ze Skrzynki do wybranych folderów.

Opis:

Zakładki, które same znajdują drogę do domu.

Homing sortuje zakładki trafiające bezpośrednio do jednego folderu Skrzynki,
który wybierzesz. Twórz proste reguły na podstawie domen, adresów URL lub słów
w tytułach zakładek i wybieraj folder docelowy dla każdej reguły. Zakładki
zapisane w innych miejscach pozostają tam, gdzie je umieścisz.

- Wybierz Skrzynkę i foldery docelowe.
- Dopasowuj domeny, subdomeny, wzorce adresów URL i słowa w tytułach.
- Ustawiaj kolejność reguł: wygrywa pierwsza włączona pasująca reguła.
- Zostawiaj niepewne dopasowania w Skrzynce do ręcznego posortowania.
- Przeglądaj ostatnie decyzje i cofaj udane automatyczne przeniesienia przez 10 minut.
- Zachowuj pierwszeństwo późniejszych ręcznych przeniesień.
- Korzystaj z interfejsu po polsku lub angielsku.

Homing przetwarza dane zakładek lokalnie. Nie stosuje analityki ani zdalnej
klasyfikacji i nie ma dostępu do treści stron. Synchronizacja zakładek działa
zgodnie z ustawieniami Twojej przeglądarki.

Masz pytanie lub pomysł? Wybierz Prześlij opinię w ustawieniach lub oknie
rozszerzenia, aby napisać na damian@warna.pl. Dane zakładek nie są dołączane
automatycznie.

## Privacy tab and reviewer instructions

Single purpose:

Automatically sort bookmarks entering one user-selected Inbox folder into
user-selected destinations using local URL and title rules.

Permission justifications:

- **bookmarks:** observe bookmark creation and movement, display folder choices,
  revalidate bookmark locations, and move only bookmarks entering the configured
  Inbox under the user's rules.
- **storage:** retain profile-specific settings, pending attempts, recent
  activity, and operational problems locally across worker suspension.
- **alarms:** periodically recover interrupted pending work after the Manifest
  V3 service worker has been suspended.
- **Remote code:** none. All executable code is bundled in the extension.

Homing reads bookmark URLs and titles locally, but transmits no bookmark data
to the developer or third parties. It contains no telemetry or analytics.
Voluntary email feedback is composed and sent by the user's mail application.

Test instructions (no login required):

1. Create two writable bookmark folders: Inbox and Docs.
2. Open Homing settings and select Inbox.
3. Add an exact-domain rule for `example.com` with destination Docs; save.
4. Add a bookmark for `https://example.com/` directly in Inbox: it moves to Docs.
5. Add `https://unmatched.example/` directly in Inbox: it stays in Inbox.
6. Open Homing's popup to inspect results and Undo the successful move.
7. Save a bookmark in any other folder: Homing leaves it untouched.
8. Select Send feedback: the link addresses a draft to damian@warna.pl; sending
   is voluntary and no diagnostics are attached.
