# MJML Email Generator

Interni MVP aplikace pro generovani e-mailovych sablon: zadani -> OpenAI Responses API -> MJML -> validace -> HTML -> preview.

## Instalace

```bash
npm install
```

## Nastaveni API klice

Vytvorte `.env.local` podle `.env.example`:

```bash
OPENAI_API_KEY=sk-...
```

Volitelne muzete nastavit i model:

```bash
OPENAI_MODEL=gpt-5.2
```

API klic se pouziva pouze v serverove route `/api/generate-email`, nikdy v klientskem kodu.

## Spusteni

```bash
npm run dev
```

Aplikace pak bezi typicky na `http://localhost:3000`.

## Jak pridat nove promenne

Whitelist je v `src/config/allowedVariables.ts`. Pridejte novou hodnotu bez slozenych zavorek, napr.:

```ts
"order.number"
```

Model smi pouzivat jen promenne z tohoto seznamu. Validace hleda vsechny vyskyty `{{...}}` v MJML a nepovolene promenne vraci jako chybu.

## Jak upravit brand kit

Brand kit je v `src/config/brandKit.ts`. Obsahuje nazev systemu, fonty, barvy, spacing, maximalni sirku e-mailu, buttony, footer a tone of voice. Hodnoty jako logo, nazev firmy a brand barvy zustavaji jako systemove promenne, napr. `{{company.logo_url}}` nebo `{{brand.primary_color}}`.

## Jak funguje MJML -> HTML prevod

1. Frontend posle zadani na `/api/generate-email`.
2. Server nacte brand kit, povolene promenne a prompt.
3. OpenAI Responses API vrati strukturovany JSON pres `text.format`.
4. Server zvaliduje promenne a zakazane konstrukce.
5. `mjml2html` z npm balicku `mjml` zkompiluje MJML do HTML.
6. Frontend zobrazi subject, preheader, MJML, HTML, iframe preview a seznam issues.

## MJML builder

V UI je rezim `MJML builder`. Ten nesaha na OpenAI API a nesklada e-mail z promptu. Rezim ma samostatny editorovy layout inspirovany MJML Builder editorem: horni toolbar, levou email structure navigaci, stredovy checkerboard canvas a pravy panel atributu vybraneho prvku. Na klientu se edituje strom bloku a globalni styly, z toho se sestavi MJML a route `/api/compile-mjml` ho serverove prevede pres `mjml2html` na HTML preview.

Bloky lze pridavat kliknutim v palete nebo pretazenim do struktury. Existujici bloky jdou ve vrstvach preskladat drag and drop, duplikovat, mazat a upravovat v inspectoru. Kontejnerove bloky jako `Section` a `Image Hero` umi obsahovat dalsi bloky, takze lze skladat texty, tlacitka, obrazky, oddelovace a mezery pod sebe nad spolecnym pozadim.

Levy panel ma samostatne zalozky `Struktura`, `Komponenty` a `Styly`. Struktura je strom tela e-mailu: koren je `Body` a pod nim jsou bloky odsazene podle vnoreni. `Head` se zde nezobrazuje, protoze jeho nastaveni patri do globalnich stylu. U `Body` a u kontejneru jako `Wrapper`, `Section` nebo `Image Hero` je tlacitko `+`, ktere otevre nabidku prvku povolenych pro dane misto. Bloky lze porad presouvat drag and dropem mezi sebou i dovnitr kontejneru. Viditelne akce u bloku jsou nahrazene klavesami: `Delete` nebo `Backspace` smaze vybrany blok, `Ctrl+D` nebo `Ctrl+C` ho zduplikuje, `Alt+Sipka nahoru/dolu` meni poradi. `Ctrl+Z` vraci zpet a `Ctrl+Y` nebo `Ctrl+Shift+Z` opakuje zpet vracenou zmenu.

Canvas podporuje desktopovy a mobilni nahled s pevnym sirkovym stitkem. Aktivni karta urcuje i to, jake atributy se edituji: na `Desktop` se upravuji vychozi hodnoty, na `Mobile` se u responzivnich atributu uklada mobilni override. Prazdna mobilni hodnota pouzije desktop. V edit modu lze kliknout primo na blok, cimz se vybere ve strukture a otevrou se jeho atributy v pravem panelu. Vybrany blok je na canvasu trvale oznaceny stitkem a zvyraznenym obrysem. Tlacitko `Preview` prepne canvas na zkompilovane HTML. Inspector umoznuje u bloku upravovat texty, odkazy, barvy, paddingy, velikosti textu, tlacitka a dalsi vlastnosti podle typu bloku.

V horni liste builderu je tlacitko `Nahrat MJML`. Nahrany `.mjml` soubor se aplikace pokusi prevest na editovatelne bloky. Bezne tagy jako `mj-section`, `mj-wrapper`, `mj-text`, `mj-button`, `mj-image`, `mj-divider`, `mj-spacer`, `mj-table`, `mj-navbar`, `mj-social`, `mj-accordion` a `mj-carousel` se mapuji na builder bloky. Slozite nebo nezname casti se vlozi jako `MJML Code`, aby se pri importu neztratily. Pokud soubor obsahuje celou sablonu vcetne `<mj-head>` a `<mj-body>`, aplikace zachova obsah `mj-head` a zpracuje obsah `mj-body`.

Barevna pole podporuji i hodnotu `transparent` nebo prazdnou hodnotu. U vetsiny bloku jsou dostupna pole `Pokrocile atributy`, kam lze doplnit libovolne MJML atributy podporovane danym tagem, napr. `padding-top="0"`, `border-radius="12px"`, `full-width="full-width"` nebo `background-url="https://..."`.

Aktualne jsou dostupne bloky:

- Header
- Section
- Wrapper
- Hero
- Text
- Button
- Image
- Image Hero
- Coupon
- 2 Columns
- 3 Columns
- Card
- Quote
- Navbar
- Social
- Table
- Accordion
- Carousel
- Divider
- Spacer
- Raw HTML
- MJML Code
- Footer

Blok `Raw HTML` vlozi vlastni HTML pres `mj-raw`. Blok `MJML Code` vlozi vlastni MJML fragment primo do tela e-mailu. Je urceny pro rucne napsane bloky typu `mj-section`, `mj-wrapper`, `mj-column`, `mj-text`, `mj-image` apod. Vysledek porad prochazi serverovou MJML validaci a kompilaci.

Definice bloku, vychozi hodnoty a pole inspectoru jsou v `src/lib/mjmlBuilder.ts`. Stejny datovy model je pripraveny pro budouci ukladani vlastnich bloku a stylu; zatim se vse drzi jen ve stavu aplikace bez databaze.

## Predpripravene sablony z Excelu

V UI je rezim `Kupony z Excelu`. Ten sklada sablonu z hodnot v nahrane excelove tabulce. Typicky pouziva sloupce `Specifikace promokodu`, `Platnost od`, `Affiliate odkaz`, `Slevovy kod` nebo `Zneni kuponu` a volitelne sloupec s logem, napr. `Logo URL`, `Odkaz na logo` nebo `Logo`. Sloupec `Platnost do` muze v Excelu zustat jako interni udaj, ale ve vestavene e-mailove sablone se nezobrazuje.

Excel slouzi jako zdroj pravdy, takze aplikace do sablony nevymysli vlastni kuponove texty. Pokud je potreba zmenit nabidku, kod, platnost, odkaz nebo logo, upravuje se tabulka a znovu nahraje do formulare.

V kuponovem rezimu lze volitelne nahrat i vlastni sablonu `.mjml` nebo `.html`. MJML sablona projde beznym prevodem pres `mjml2html`. HTML sablona se bere jako hotove HTML a aplikace v ni upravi odkazy, kody, platnosti a loga podle nahraneho Excelu.

Volba `Použít AI párování` pouzije OpenAI Responses API jen k vytvoreni mapy mezi radky Excelu a bloky sablony. AI neprepisuje layout ani negeneruje MJML; vraci pouze JSON s indexy paru a aplikace pak provede samotny prepis. Tato volba vyzaduje `OPENAI_API_KEY`.

### Tokenova kuponova sablona

Pro skladani z jednoho ukazkoveho bloku nahrajte MJML sablonu, ktera obsahuje header, jeden kuponovy blok a footer. V headeru i bloku pouzijte tokeny ve tvaru:

```text
[?NAZEV SLOUPCE?]
```

Priklad:

```text
[?MESIC?]
[?SPECIFIKACE PROMOKODU?]
[?ODKAZ NA LOGO?]
[?AFFILIATE ODKAZ?]
[?SLEVOVY KOD?]
[?PODMINKA?]
[?PLATNOST OD?]
```

Aplikace najde prvni `mj-section`, ktery obsahuje tokeny krome `[?MESIC?]`, vezme ho jako ukazkovy blok a vytvori jeho kopii pro kazdy datovy radek v Excelu. Header a footer zustanou ve vystupu pouze jednou. Token `[?MESIC?]` se doplni z pole `Mesic do headeru`; pokud zustane prazdne, pouzije se aktualni mesic. Pokud je token pro logo prazdny, prislusny `mj-image` se z kuponoveho bloku odstrani.

Volba `AI kontrola textu a hodnot` nezasahuje do skladani sablony. Sablona se nejdrive deterministicky sestavi z Excelu a tokenu, potom OpenAI Responses API porovna zdrojove radky s vyslednym MJML a vrati jen upozorneni nebo chyby ve validaci. Kontroluje zejmena texty, kuponove kody, affiliate odkazy, zamerne zobrazene platnosti, loga a podezrele formulace. Absenci interniho sloupce `Platnost do` v e-mailu nehlasi jako chybu. Tato kontrola vyzaduje `OPENAI_API_KEY`.

## Struktura

- `src/app/page.tsx` - hlavni UI s formularem, taby a preview
- `src/app/api/generate-email/route.ts` - serverova API route
- `src/app/api/compile-mjml/route.ts` - serverova MJML kompilace pro builder
- `src/config/brandKit.ts` - lokalni brand kit
- `src/config/allowedVariables.ts` - whitelist systemovych promennych
- `src/lib/emailComponents.ts` - doporucene MJML bloky
- `src/lib/prompts.ts` - system a user prompt
- `src/lib/validateEmail.ts` - extrakce promennych, validace a MJML kompilace
- `src/lib/couponWorkbook.ts` - cteni Excelu s kupony
- `src/lib/couponAiReview.ts` - AI kontrola kuponove sablony proti Excelu
- `src/lib/preparedTemplates.ts` - predpripravene MJML sablony
- `src/lib/mjmlBuilder.ts` - definice builder bloku, stylu a skladani MJML
