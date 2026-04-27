export type BuilderFieldType =
  | "text"
  | "textarea"
  | "url"
  | "color"
  | "number"
  | "code";

export type BuilderRenderDevice = "desktop" | "mobile";

export type BuilderBlockType =
  | "section"
  | "wrapper"
  | "header"
  | "hero"
  | "text"
  | "button"
  | "image"
  | "image-hero"
  | "coupon"
  | "two-column"
  | "three-column"
  | "card"
  | "quote"
  | "navbar"
  | "social"
  | "table"
  | "accordion"
  | "carousel"
  | "divider"
  | "spacer"
  | "raw-html"
  | "raw-mjml"
  | "footer";

export type BuilderField = {
  key: string;
  label: string;
  type: BuilderFieldType;
};

export type BuilderBlockDefinition = {
  type: BuilderBlockType;
  label: string;
  description: string;
  defaults: Record<string, string>;
  fields: BuilderField[];
  acceptsChildren?: boolean;
  childTypes?: BuilderBlockType[];
};

export type BuilderBlock = {
  id: string;
  type: BuilderBlockType;
  props: Record<string, string>;
  mobileProps?: Record<string, string>;
  children?: BuilderBlock[];
};

export type BuilderTheme = {
  width: string;
  fontFamily: string;
  bodyBackground: string;
  primaryColor: string;
  sectionBackground: string;
  textColor: string;
  mutedColor: string;
  buttonBackground: string;
  buttonText: string;
  defaultSectionPadding: string;
  defaultTextSize: string;
  defaultLineHeight: string;
  breakpoint: string;
  headTitle: string;
  previewText: string;
  globalAttributes: string;
};

export const defaultBuilderTheme: BuilderTheme = {
  width: "600px",
  fontFamily: "Arial, sans-serif",
  bodyBackground: "#f6f6f6",
  primaryColor: "#1a90e9",
  sectionBackground: "#ffffff",
  textColor: "#333333",
  mutedColor: "#777777",
  buttonBackground: "#eeeeee",
  buttonText: "#1a90e9",
  defaultSectionPadding: "24px 30px",
  defaultTextSize: "16px",
  defaultLineHeight: "24px",
  breakpoint: "480px",
  headTitle: "",
  previewText: "",
  globalAttributes: ""
};

export const builderBlockDefinitions: BuilderBlockDefinition[] = [
  {
    type: "section",
    label: "Section",
    description: "Kontejner pro skladani prvku pod sebe.",
    acceptsChildren: true,
    childTypes: [
      "text",
      "button",
      "image",
      "card",
      "quote",
      "navbar",
      "social",
      "table",
      "accordion",
      "carousel",
      "divider",
      "spacer",
      "raw-html"
    ],
    defaults: {
      backgroundColor: "#ffffff",
      backgroundUrl: "",
      padding: "24px 30px",
      verticalAlign: "top",
      sectionAttributes: "",
      columnAttributes: ""
    },
    fields: [
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "backgroundUrl", label: "Obrazek na pozadi", type: "url" },
      { key: "padding", label: "Vnitrni okraje", type: "text" },
      { key: "verticalAlign", label: "Svisle zarovnani", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" }
    ]
  },
  {
    type: "wrapper",
    label: "Wrapper",
    description: "Kontejner pro vice sekci se spolecnym pozadim.",
    acceptsChildren: true,
    childTypes: [
      "section",
      "header",
      "hero",
      "text",
      "button",
      "image",
      "coupon",
      "two-column",
      "three-column",
      "card",
      "quote",
      "navbar",
      "social",
      "table",
      "accordion",
      "carousel",
      "divider",
      "spacer",
      "raw-mjml",
      "footer"
    ],
    defaults: {
      backgroundColor: "#ffffff",
      padding: "0",
      borderRadius: "",
      wrapperAttributes: "",
      sectionAttributes: "",
      columnAttributes: ""
    },
    fields: [
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "padding", label: "Padding wrapperu", type: "text" },
      { key: "borderRadius", label: "Zaobleni", type: "text" },
      { key: "wrapperAttributes", label: "Pokrocile atributy mj-wrapper", type: "code" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" }
    ]
  },
  {
    type: "header",
    label: "Header",
    description: "Nadpis a uvodni text.",
    defaults: {
      title: "Slevove kody pro verne zakazniky",
      text: "Vazeni zakaznici,\npripravili jsme pro vas aktualni vyhody.",
      backgroundColor: "#ffffff",
      titleSize: "26px",
      textSize: "16px",
      padding: "30px"
    },
    fields: [
      { key: "title", label: "Nadpis", type: "text" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "titleSize", label: "Velikost nadpisu", type: "text" },
      { key: "textSize", label: "Velikost textu", type: "text" },
      { key: "padding", label: "Vnitrni okraje", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" },
      { key: "titleAttributes", label: "Pokrocile atributy nadpisu", type: "code" },
      { key: "textAttributes", label: "Pokrocile atributy textu", type: "code" }
    ]
  },
  {
    type: "hero",
    label: "Hero",
    description: "Vyrazny uvodni blok.",
    defaults: {
      eyebrow: "Aktualni nabidka",
      title: "Vyhody pro nase zakazniky",
      text: "Vyberte si z aktualnich slev a partnerskych nabidek.",
      backgroundColor: "#e9f6fc",
      titleSize: "28px",
      padding: "30px",
      sectionAttributes: "",
      columnAttributes: "",
      titleAttributes: "",
      textAttributes: ""
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Nadpis", type: "text" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "titleSize", label: "Velikost nadpisu", type: "text" },
      { key: "padding", label: "Vnitrni okraje", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" },
      { key: "titleAttributes", label: "Pokrocile atributy nadpisu", type: "code" },
      { key: "textAttributes", label: "Pokrocile atributy textu", type: "code" }
    ]
  },
  {
    type: "text",
    label: "Text",
    description: "Jednoduchy textovy odstavec.",
    defaults: {
      text: "Sem vlozte text odstavce.",
      align: "left",
      backgroundColor: "#ffffff",
      textColor: "",
      fontSize: "16px",
      lineHeight: "24px",
      padding: "24px 30px",
      sectionAttributes: "",
      columnAttributes: "",
      textAttributes: ""
    },
    fields: [
      { key: "text", label: "Text", type: "textarea" },
      { key: "align", label: "Zarovnani", type: "text" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "textColor", label: "Barva textu", type: "color" },
      { key: "fontSize", label: "Velikost textu", type: "text" },
      { key: "lineHeight", label: "Radkovani", type: "text" },
      { key: "padding", label: "Vnitrni okraje", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" },
      { key: "textAttributes", label: "Pokrocile atributy mj-text", type: "code" }
    ]
  },
  {
    type: "button",
    label: "Button",
    description: "CTA tlacitko.",
    defaults: {
      label: "Zobrazit nabidku",
      href: "https://www.example.com",
      align: "center",
      backgroundColor: "",
      textColor: "",
      borderRadius: "8px",
      innerPadding: "12px 24px",
      sectionPadding: "10px 30px",
      sectionBackground: "",
      sectionAttributes: "",
      columnAttributes: "",
      buttonAttributes: ""
    },
    fields: [
      { key: "label", label: "Text tlacitka", type: "text" },
      { key: "href", label: "URL", type: "url" },
      { key: "align", label: "Zarovnani", type: "text" },
      { key: "backgroundColor", label: "Pozadi tlacitka", type: "color" },
      { key: "textColor", label: "Text tlacitka", type: "color" },
      { key: "borderRadius", label: "Zaobleni", type: "text" },
      { key: "innerPadding", label: "Okraje tlacitka", type: "text" },
      { key: "sectionPadding", label: "Okraje sekce", type: "text" },
      { key: "sectionBackground", label: "Pozadi sekce", type: "color" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" },
      { key: "buttonAttributes", label: "Pokrocile atributy mj-button", type: "code" }
    ]
  },
  {
    type: "image",
    label: "Image",
    description: "Obrazek nebo logo.",
    defaults: {
      src: "https://www.starnet.cz/download/mail/gorenje_logo_kupony.png",
      alt: "",
      width: "140px",
      padding: "20px 30px",
      backgroundColor: "#ffffff",
      align: "center",
      borderRadius: "",
      sectionAttributes: "",
      columnAttributes: "",
      imageAttributes: ""
    },
    fields: [
      { key: "src", label: "URL obrazku", type: "url" },
      { key: "alt", label: "Alt text", type: "text" },
      { key: "width", label: "Sirka", type: "text" },
      { key: "align", label: "Zarovnani", type: "text" },
      { key: "borderRadius", label: "Zaobleni", type: "text" },
      { key: "padding", label: "Okraje sekce", type: "text" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" },
      { key: "imageAttributes", label: "Pokrocile atributy mj-image", type: "code" }
    ]
  },
  {
    type: "image-hero",
    label: "Image Hero",
    description: "Text a CTA pres obrazek na pozadi pomoci mj-hero.",
    acceptsChildren: true,
    childTypes: [
      "text",
      "button",
      "image",
      "card",
      "quote",
      "divider",
      "spacer",
      "raw-html"
    ],
    defaults: {
      backgroundUrl: "https://www.starnet.cz/download/mail/gorenje_logo_kupony.png",
      title: "Nadpis pres obrazek",
      text: "Kratky text pres obrazek. V emailu pouzivej dostatecny kontrast.",
      ctaLabel: "Zobrazit nabidku",
      ctaHref: "https://www.example.com",
      mode: "fixed-height",
      height: "360px",
      backgroundWidth: "600px",
      backgroundHeight: "360px",
      backgroundColor: "#1F2937",
      backgroundPosition: "center center",
      verticalAlign: "middle",
      align: "center",
      textColor: "#ffffff",
      titleSize: "32px",
      textSize: "16px",
      padding: "40px 30px",
      buttonBackground: "#ffffff",
      buttonText: "#1a90e9",
      heroAttributes: "",
      titleAttributes: "",
      textAttributes: "",
      buttonAttributes: ""
    },
    fields: [
      { key: "backgroundUrl", label: "URL obrazku na pozadi", type: "url" },
      { key: "title", label: "Nadpis", type: "text" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "ctaLabel", label: "CTA text", type: "text" },
      { key: "ctaHref", label: "CTA URL", type: "url" },
      { key: "mode", label: "Mode", type: "text" },
      { key: "height", label: "Vyska", type: "text" },
      { key: "backgroundWidth", label: "Sirka pozadi", type: "text" },
      { key: "backgroundHeight", label: "Vyska pozadi", type: "text" },
      { key: "backgroundColor", label: "Fallback pozadi", type: "color" },
      { key: "backgroundPosition", label: "Pozice pozadi", type: "text" },
      { key: "verticalAlign", label: "Svisle zarovnani", type: "text" },
      { key: "align", label: "Zarovnani textu", type: "text" },
      { key: "textColor", label: "Barva textu", type: "color" },
      { key: "titleSize", label: "Velikost nadpisu", type: "text" },
      { key: "textSize", label: "Velikost textu", type: "text" },
      { key: "padding", label: "Vnitrni okraje", type: "text" },
      { key: "buttonBackground", label: "Pozadi tlacitka", type: "color" },
      { key: "buttonText", label: "Text tlacitka", type: "color" },
      { key: "heroAttributes", label: "Pokrocile atributy mj-hero", type: "code" },
      { key: "titleAttributes", label: "Pokrocile atributy nadpisu", type: "code" },
      { key: "textAttributes", label: "Pokrocile atributy textu", type: "code" },
      { key: "buttonAttributes", label: "Pokrocile atributy tlacitka", type: "code" }
    ]
  },
  {
    type: "coupon",
    label: "Coupon",
    description: "Kuponovy blok se slevovym kodem.",
    defaults: {
      title: "Sleva 20 % na vybrane produkty",
      logoUrl: "",
      code: "KOD20",
      href: "https://www.example.com",
      condition: "Kod bude platny pouze pri nakupu pres odkaz z tohoto emailu.",
      validFrom: "Platnost od 01. 01. 2026",
      backgroundColor: "#e9f6fc",
      buttonBackground: "",
      buttonText: "",
      titleSize: "16px",
      padding: "10px 15px",
      sectionAttributes: "",
      columnAttributes: "",
      titleAttributes: "",
      logoAttributes: "",
      buttonAttributes: "",
      conditionAttributes: ""
    },
    fields: [
      { key: "title", label: "Nadpis kuponu", type: "textarea" },
      { key: "logoUrl", label: "Logo URL", type: "url" },
      { key: "code", label: "Kod", type: "text" },
      { key: "href", label: "Affiliate URL", type: "url" },
      { key: "condition", label: "Podminka", type: "textarea" },
      { key: "validFrom", label: "Platnost", type: "text" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "buttonBackground", label: "Pozadi tlacitka", type: "color" },
      { key: "buttonText", label: "Text tlacitka", type: "color" },
      { key: "titleSize", label: "Velikost nadpisu", type: "text" },
      { key: "padding", label: "Vnitrni okraje", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" },
      { key: "titleAttributes", label: "Pokrocile atributy nadpisu", type: "code" },
      { key: "logoAttributes", label: "Pokrocile atributy loga", type: "code" },
      { key: "buttonAttributes", label: "Pokrocile atributy tlacitka", type: "code" },
      { key: "conditionAttributes", label: "Pokrocile atributy podminky", type: "code" }
    ]
  },
  {
    type: "three-column",
    label: "3 Columns",
    description: "Tri jednoduche sloupce pro benefity, ikony nebo odkazy.",
    defaults: {
      title1: "Benefit 1",
      text1: "Kratky popis prvniho benefitu.",
      title2: "Benefit 2",
      text2: "Kratky popis druheho benefitu.",
      title3: "Benefit 3",
      text3: "Kratky popis tretiho benefitu.",
      backgroundColor: "#ffffff",
      padding: "24px 30px",
      sectionAttributes: "",
      columnAttributes: ""
    },
    fields: [
      { key: "title1", label: "Nadpis 1", type: "text" },
      { key: "text1", label: "Text 1", type: "textarea" },
      { key: "title2", label: "Nadpis 2", type: "text" },
      { key: "text2", label: "Text 2", type: "textarea" },
      { key: "title3", label: "Nadpis 3", type: "text" },
      { key: "text3", label: "Text 3", type: "textarea" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "padding", label: "Padding", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy sloupcu", type: "code" }
    ]
  },
  {
    type: "card",
    label: "Card",
    description: "Obsahova karta s obrazkem, nadpisem, textem a CTA.",
    defaults: {
      imageUrl: "",
      title: "Nadpis karty",
      text: "Text karty s kratkym popisem.",
      ctaLabel: "",
      ctaHref: "#",
      backgroundColor: "#F8FAFC",
      textColor: "",
      padding: "20px",
      borderRadius: "8px",
      sectionAttributes: "",
      columnAttributes: "",
      buttonAttributes: ""
    },
    fields: [
      { key: "imageUrl", label: "Obrazek", type: "url" },
      { key: "title", label: "Nadpis", type: "text" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "ctaLabel", label: "CTA text", type: "text" },
      { key: "ctaHref", label: "CTA URL", type: "url" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "textColor", label: "Barva textu", type: "color" },
      { key: "padding", label: "Padding", type: "text" },
      { key: "borderRadius", label: "Zaobleni", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" },
      { key: "buttonAttributes", label: "Pokrocile atributy tlacitka", type: "code" }
    ]
  },
  {
    type: "quote",
    label: "Quote",
    description: "Citace nebo testimonial.",
    defaults: {
      quote: "Kratka citace zakaznika nebo dulezita veta.",
      author: "Jmeno / firma",
      backgroundColor: "#ffffff",
      accentColor: "#1a90e9",
      textColor: "",
      padding: "24px 30px",
      sectionAttributes: "",
      textAttributes: ""
    },
    fields: [
      { key: "quote", label: "Citace", type: "textarea" },
      { key: "author", label: "Autor", type: "text" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "accentColor", label: "Akcent", type: "color" },
      { key: "textColor", label: "Barva textu", type: "color" },
      { key: "padding", label: "Padding", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "textAttributes", label: "Pokrocile atributy mj-text", type: "code" }
    ]
  },
  {
    type: "navbar",
    label: "Navbar",
    description: "Navigacni menu pomoci mj-navbar.",
    defaults: {
      baseUrl: "https://www.example.com",
      link1Label: "Web",
      link1Href: "/",
      link2Label: "Podpora",
      link2Href: "/podpora",
      link3Label: "Kontakt",
      link3Href: "/kontakt",
      color: "#172033",
      hamburger: "",
      backgroundColor: "#ffffff",
      padding: "12px 30px",
      navbarAttributes: "",
      linkAttributes: ""
    },
    fields: [
      { key: "baseUrl", label: "Base URL", type: "url" },
      { key: "link1Label", label: "Odkaz 1 text", type: "text" },
      { key: "link1Href", label: "Odkaz 1 URL", type: "text" },
      { key: "link2Label", label: "Odkaz 2 text", type: "text" },
      { key: "link2Href", label: "Odkaz 2 URL", type: "text" },
      { key: "link3Label", label: "Odkaz 3 text", type: "text" },
      { key: "link3Href", label: "Odkaz 3 URL", type: "text" },
      { key: "color", label: "Barva odkazu", type: "color" },
      { key: "hamburger", label: "Hamburger", type: "text" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "padding", label: "Padding", type: "text" },
      { key: "navbarAttributes", label: "Pokrocile atributy mj-navbar", type: "code" },
      { key: "linkAttributes", label: "Pokrocile atributy odkazu", type: "code" }
    ]
  },
  {
    type: "social",
    label: "Social",
    description: "Socialni ikony a odkazy pomoci mj-social.",
    defaults: {
      align: "center",
      mode: "horizontal",
      iconSize: "28px",
      fontSize: "13px",
      facebook: "https://www.facebook.com/",
      instagram: "https://www.instagram.com/",
      web: "https://www.example.com",
      color: "#172033",
      backgroundColor: "#ffffff",
      padding: "16px 30px",
      socialAttributes: "",
      elementAttributes: ""
    },
    fields: [
      { key: "align", label: "Zarovnani", type: "text" },
      { key: "mode", label: "Mode", type: "text" },
      { key: "iconSize", label: "Velikost ikon", type: "text" },
      { key: "fontSize", label: "Velikost textu", type: "text" },
      { key: "facebook", label: "Facebook URL", type: "url" },
      { key: "instagram", label: "Instagram URL", type: "url" },
      { key: "web", label: "Web URL", type: "url" },
      { key: "color", label: "Barva textu", type: "color" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "padding", label: "Padding", type: "text" },
      { key: "socialAttributes", label: "Pokrocile atributy mj-social", type: "code" },
      { key: "elementAttributes", label: "Pokrocile atributy prvku", type: "code" }
    ]
  },
  {
    type: "table",
    label: "Table",
    description: "Tabulka pres mj-table.",
    defaults: {
      rows: `<tr><th align="left">Polozka</th><th align="right">Hodnota</th></tr>
<tr><td>Tarif</td><td align="right">Premium</td></tr>
<tr><td>Cena</td><td align="right">499 Kc</td></tr>`,
      color: "#172033",
      fontSize: "14px",
      lineHeight: "20px",
      backgroundColor: "#ffffff",
      padding: "20px 30px",
      tableAttributes: ""
    },
    fields: [
      { key: "rows", label: "HTML radky tabulky", type: "code" },
      { key: "color", label: "Barva textu", type: "color" },
      { key: "fontSize", label: "Velikost textu", type: "text" },
      { key: "lineHeight", label: "Radkovani", type: "text" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "padding", label: "Padding", type: "text" },
      { key: "tableAttributes", label: "Pokrocile atributy mj-table", type: "code" }
    ]
  },
  {
    type: "accordion",
    label: "Accordion",
    description: "Rozbalovaci obsah pomoci mj-accordion.",
    defaults: {
      title1: "Otazka 1",
      text1: "Odpoved nebo detail prvni polozky.",
      title2: "Otazka 2",
      text2: "Odpoved nebo detail druhe polozky.",
      backgroundColor: "#ffffff",
      titleBackground: "#F4F7FB",
      textBackground: "#ffffff",
      color: "#172033",
      padding: "20px 30px",
      accordionAttributes: "",
      elementAttributes: ""
    },
    fields: [
      { key: "title1", label: "Nadpis 1", type: "text" },
      { key: "text1", label: "Text 1", type: "textarea" },
      { key: "title2", label: "Nadpis 2", type: "text" },
      { key: "text2", label: "Text 2", type: "textarea" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "titleBackground", label: "Pozadi nadpisu", type: "color" },
      { key: "textBackground", label: "Pozadi textu", type: "color" },
      { key: "color", label: "Barva textu", type: "color" },
      { key: "padding", label: "Padding", type: "text" },
      { key: "accordionAttributes", label: "Pokrocile atributy mj-accordion", type: "code" },
      { key: "elementAttributes", label: "Pokrocile atributy polozek", type: "code" }
    ]
  },
  {
    type: "carousel",
    label: "Carousel",
    description: "Obrazkovy carousel pomoci mj-carousel.",
    defaults: {
      image1: "https://www.starnet.cz/download/mail/gorenje_logo_kupony.png",
      image2: "",
      image3: "",
      width: "560px",
      borderRadius: "6px",
      backgroundColor: "#ffffff",
      padding: "20px 30px",
      carouselAttributes: "",
      imageAttributes: ""
    },
    fields: [
      { key: "image1", label: "Obrazek 1", type: "url" },
      { key: "image2", label: "Obrazek 2", type: "url" },
      { key: "image3", label: "Obrazek 3", type: "url" },
      { key: "width", label: "Sirka", type: "text" },
      { key: "borderRadius", label: "Zaobleni", type: "text" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "padding", label: "Padding", type: "text" },
      { key: "carouselAttributes", label: "Pokrocile atributy mj-carousel", type: "code" },
      { key: "imageAttributes", label: "Pokrocile atributy obrazku", type: "code" }
    ]
  },
  {
    type: "two-column",
    label: "2 Columns",
    description: "Dva textove sloupce.",
    defaults: {
      leftTitle: "Levy blok",
      leftText: "Text leveho sloupce.",
      rightTitle: "Pravy blok",
      rightText: "Text praveho sloupce.",
      backgroundColor: "#ffffff",
      padding: "24px 30px",
      sectionAttributes: "",
      leftColumnAttributes: "",
      rightColumnAttributes: ""
    },
    fields: [
      { key: "leftTitle", label: "Levy nadpis", type: "text" },
      { key: "leftText", label: "Levy text", type: "textarea" },
      { key: "rightTitle", label: "Pravy nadpis", type: "text" },
      { key: "rightText", label: "Pravy text", type: "textarea" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "padding", label: "Vnitrni okraje", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "leftColumnAttributes", label: "Pokrocile atributy leveho sloupce", type: "code" },
      { key: "rightColumnAttributes", label: "Pokrocile atributy praveho sloupce", type: "code" }
    ]
  },
  {
    type: "divider",
    label: "Divider",
    description: "Oddelovaci cara.",
    defaults: {
      color: "#d9e2ec"
    },
    fields: [{ key: "color", label: "Barva", type: "color" }]
  },
  {
    type: "spacer",
    label: "Spacer",
    description: "Svisla mezera.",
    defaults: {
      height: "24px"
    },
    fields: [{ key: "height", label: "Vyska", type: "text" }]
  },
  {
    type: "raw-html",
    label: "Raw HTML",
    description: "Vlastni HTML fragment vlozeny pres mj-raw.",
    defaults: {
      source: `<div style="font-family: Arial, sans-serif; font-size: 14px;">
  Vlastni HTML blok
</div>`
    },
    fields: [{ key: "source", label: "HTML zdrojovy kod", type: "code" }]
  },
  {
    type: "raw-mjml",
    label: "MJML Code",
    description: "Vlastni MJML fragment vlozeny primo do tela e-mailu.",
    defaults: {
      source: `<mj-section background-color="#ffffff" padding="24px 30px">
  <mj-column>
    <mj-text font-size="16px" line-height="24px" color="#333333" padding="0">
      Vlastni MJML blok
    </mj-text>
  </mj-column>
</mj-section>`
    },
    fields: [{ key: "source", label: "MJML zdrojovy kod", type: "code" }]
  },
  {
    type: "footer",
    label: "Footer",
    description: "Pata e-mailu.",
    defaults: {
      text: "[!company_name!] Vam preje prijemne nakupovani. Dekujeme, ze jste s nami.",
      backgroundColor: "#1a90e9",
      textColor: "#ffffff",
      padding: "20px 30px",
      sectionAttributes: "",
      columnAttributes: "",
      textAttributes: ""
    },
    fields: [
      { key: "text", label: "Text", type: "textarea" },
      { key: "backgroundColor", label: "Pozadi", type: "color" },
      { key: "textColor", label: "Barva textu", type: "color" },
      { key: "padding", label: "Vnitrni okraje", type: "text" },
      { key: "sectionAttributes", label: "Pokrocile atributy mj-section", type: "code" },
      { key: "columnAttributes", label: "Pokrocile atributy mj-column", type: "code" },
      { key: "textAttributes", label: "Pokrocile atributy mj-text", type: "code" }
    ]
  }
];

export const defaultBuilderBlocks: BuilderBlock[] = [
  createBuilderBlock("header", "block-header"),
  createBuilderBlock("coupon", "block-coupon"),
  createBuilderBlock("footer", "block-footer")
];

export function createBuilderBlock(
  type: BuilderBlockType,
  id = `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`
): BuilderBlock {
  const definition = getBlockDefinition(type);
  return {
    id,
    type,
    props: { ...definition.defaults },
    children: definition.acceptsChildren ? [] : undefined
  };
}

export function getBlockDefinition(type: BuilderBlockType): BuilderBlockDefinition {
  const definition = builderBlockDefinitions.find((item) => item.type === type);
  if (!definition) {
    throw new Error(`Unknown builder block type: ${type}`);
  }
  return definition;
}

export function getBuilderBlockProps(
  block: BuilderBlock,
  device: BuilderRenderDevice = "desktop"
): Record<string, string> {
  if (device === "mobile") {
    return { ...block.props, ...(block.mobileProps || {}) };
  }

  return block.props;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value: string | undefined): string {
  return escapeXml(String(value || ""));
}

function richText(value: string | undefined): string {
  return text(value).replace(/\n/g, "<br />");
}

function attr(value: string | undefined, fallback = ""): string {
  return escapeXml(String(value || fallback));
}

function optionalAttr(name: string, value: string | undefined): string {
  const normalized = String(value || "").trim();
  return normalized ? ` ${name}="${attr(normalized)}"` : "";
}

function rawAttributes(value: string | undefined): string {
  const cleaned = String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? ` ${cleaned}` : "";
}

function colorValue(value: string | undefined, fallback = "") {
  if (value === "transparent") {
    return "transparent";
  }
  return value || fallback;
}

function section(
  content: string,
  options: { backgroundColor?: string; padding?: string; attributes?: string } = {}
) {
  return `
    <mj-section background-color="${attr(options.backgroundColor, "#ffffff")}" padding="${attr(
      options.padding,
      "15px"
    )}"${rawAttributes(options.attributes)}>
      ${content}
    </mj-section>`;
}

function column(
  content: string,
  options: { width?: string; padding?: string; attributes?: string } = {}
) {
  return `
      <mj-column${options.width ? ` width="${attr(options.width)}"` : ""} padding="${attr(
        options.padding,
        "0"
      )}"${rawAttributes(options.attributes)}>
        ${content}
      </mj-column>`;
}

function renderChildren(
  block: BuilderBlock,
  theme: BuilderTheme,
  device: BuilderRenderDevice
): string {
  return (block.children || [])
    .map((child) => renderBlock(child, theme, "child", device))
    .filter(Boolean)
    .join("\n");
}

function renderBlock(
  block: BuilderBlock,
  theme: BuilderTheme,
  context: "root" | "child" = "root",
  device: BuilderRenderDevice = "desktop"
): string {
  const p = getBuilderBlockProps(block, device);

  switch (block.type) {
    case "section": {
      const content = renderChildren(block, theme, device);
      return section(
        column(
          content ||
            `<mj-text align="center" color="${attr(
              theme.mutedColor
            )}" padding="0">Prazdna sekce</mj-text>`,
          {
            attributes: `${p.verticalAlign ? `vertical-align="${attr(p.verticalAlign)}"` : ""} ${
              p.columnAttributes || ""
            }`
          }
        ),
        {
          backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
          padding: p.padding || theme.defaultSectionPadding,
          attributes: `${p.backgroundUrl ? `background-url="${attr(p.backgroundUrl)}"` : ""} ${
            p.sectionAttributes || ""
          }`
        }
      );
    }

    case "wrapper": {
      const content = (block.children || [])
        .map((child) => renderBlock(child, theme, "root", device))
        .filter(Boolean)
        .join("\n");
      const fallback = `<mj-text align="center" color="${attr(
        theme.mutedColor
      )}" padding="0">Prazdny wrapper</mj-text>`;

      if (context === "child") {
        return content;
      }

      return `
    <mj-wrapper background-color="${attr(
      colorValue(p.backgroundColor, theme.sectionBackground)
    )}" padding="${attr(p.padding, "0")}"${optionalAttr(
        "border-radius",
        p.borderRadius
      )}${rawAttributes(p.wrapperAttributes)}>
      ${content || section(column(fallback), { padding: "0", attributes: p.sectionAttributes })}
    </mj-wrapper>`;
    }

    case "header":
      return section(
        column(`
          <mj-text font-size="${attr(p.titleSize, "26px")}" color="${attr(theme.primaryColor)}" font-weight="700" padding="0 0 18px 0"${rawAttributes(
            p.titleAttributes
          )}>${richText(
            p.title
          )}</mj-text>
          <mj-text font-size="${attr(p.textSize, "16px")}" line-height="${attr(
            theme.defaultLineHeight,
            "24px"
          )}" color="${attr(theme.textColor)}" padding="0"${rawAttributes(
            p.textAttributes
          )}>${richText(
            p.text
          )}</mj-text>
        `, { attributes: p.columnAttributes }),
        {
          backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
          padding: p.padding || "30px",
          attributes: p.sectionAttributes
        }
      );

    case "hero":
      return section(
        column(`
          <mj-text font-size="12px" color="${attr(theme.primaryColor)}" font-weight="700" padding="0 0 8px 0">${richText(
            p.eyebrow
          )}</mj-text>
          <mj-text font-size="${attr(p.titleSize, "28px")}" color="${attr(theme.textColor)}" font-weight="700" padding="0 0 12px 0"${rawAttributes(
            p.titleAttributes
          )}>${richText(
            p.title
          )}</mj-text>
          <mj-text font-size="${attr(theme.defaultTextSize, "16px")}" line-height="${attr(
            theme.defaultLineHeight,
            "24px"
          )}" color="${attr(theme.textColor)}" padding="0"${rawAttributes(
            p.textAttributes
          )}>${richText(
            p.text
          )}</mj-text>
        `, { attributes: p.columnAttributes }),
        {
          backgroundColor: colorValue(p.backgroundColor, "#e9f6fc"),
          padding: p.padding || "30px",
          attributes: p.sectionAttributes
        }
      );

    case "text":
      if (context === "child") {
        return `<mj-text align="${attr(p.align, "left")}" font-size="${attr(
          p.fontSize,
          theme.defaultTextSize || "16px"
        )}" line-height="${attr(
          p.lineHeight,
          theme.defaultLineHeight || "24px"
        )}" color="${attr(p.textColor || theme.textColor)}" padding="${attr(
          p.padding,
          "0 0 12px 0"
        )}"${rawAttributes(p.textAttributes)}>${richText(p.text)}</mj-text>`;
      }
      return section(
        column(`
          <mj-text align="${attr(p.align, "left")}" font-size="${attr(
            p.fontSize,
            "16px"
          )}" line-height="${attr(p.lineHeight, "24px")}" color="${attr(
            p.textColor || theme.textColor
          )}" padding="0"${rawAttributes(p.textAttributes)}>${richText(p.text)}</mj-text>
        `, { attributes: p.columnAttributes }),
        {
          backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
          padding: p.padding || theme.defaultSectionPadding || "24px 30px",
          attributes: p.sectionAttributes
        }
      );

    case "button":
      if (context === "child") {
        return `<mj-button align="${attr(p.align, "center")}" href="${attr(
          p.href
        )}" background-color="${attr(
          p.backgroundColor || theme.buttonBackground
        )}" color="${attr(p.textColor || theme.buttonText)}" border-radius="${attr(
          p.borderRadius,
          "8px"
        )}" inner-padding="${attr(p.innerPadding, "12px 24px")}" padding="${attr(
          p.sectionPadding,
          "0 0 12px 0"
        )}"${rawAttributes(p.buttonAttributes)}>${richText(p.label)}</mj-button>`;
      }
      return section(
        column(`
          <mj-button align="${attr(p.align, "center")}" href="${attr(p.href)}" background-color="${attr(
          p.backgroundColor || theme.buttonBackground
        )}" color="${attr(p.textColor || theme.buttonText)}" border-radius="${attr(
          p.borderRadius,
          "8px"
        )}" inner-padding="${attr(p.innerPadding, "12px 24px")}"${rawAttributes(
          p.buttonAttributes
        )}>${richText(
          p.label
        )}</mj-button>
        `, { attributes: p.columnAttributes }),
        {
          backgroundColor: colorValue(p.sectionBackground, theme.sectionBackground),
          padding: p.sectionPadding || "10px 30px",
          attributes: p.sectionAttributes
        }
      );

    case "image":
      if (!p.src) {
        return "";
      }
      if (context === "child") {
        return `<mj-image align="${attr(p.align, "center")}" src="${attr(
          p.src
        )}" alt="${attr(p.alt)}" width="${attr(
          p.width,
          "140px"
        )}"${optionalAttr("border-radius", p.borderRadius)} padding="${attr(
          p.padding,
          "0 0 12px 0"
        )}"${rawAttributes(p.imageAttributes)}></mj-image>`;
      }
      return section(
        column(`
          <mj-image align="${attr(p.align, "center")}" src="${attr(p.src)}" alt="${attr(p.alt)}" width="${attr(
          p.width,
          "140px"
        )}"${optionalAttr("border-radius", p.borderRadius)} padding="0"${rawAttributes(
          p.imageAttributes
        )}></mj-image>
        `, { attributes: p.columnAttributes }),
        {
          backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
          padding: p.padding || "20px 30px",
          attributes: p.sectionAttributes
        }
      );

    case "image-hero":
      {
        const childContent = renderChildren(block, theme, device);
        const fallbackContent = `
      <mj-text align="${attr(p.align, "center")}" color="${attr(
        p.textColor,
        "#ffffff"
      )}" font-size="${attr(p.titleSize, "32px")}" font-weight="700" line-height="40px" padding="0 0 12px 0"${rawAttributes(
        p.titleAttributes
      )}>${richText(p.title)}</mj-text>
      <mj-text align="${attr(p.align, "center")}" color="${attr(
        p.textColor,
        "#ffffff"
      )}" font-size="${attr(p.textSize, "16px")}" line-height="24px" padding="0 0 18px 0"${rawAttributes(
        p.textAttributes
      )}>${richText(p.text)}</mj-text>
      ${
        p.ctaLabel
          ? `<mj-button align="${attr(p.align, "center")}" href="${attr(
              p.ctaHref
            )}" background-color="${attr(
              p.buttonBackground || theme.buttonBackground
            )}" color="${attr(
              p.buttonText || theme.buttonText
            )}" border-radius="8px" inner-padding="12px 24px"${rawAttributes(
              p.buttonAttributes
            )}>${richText(p.ctaLabel)}</mj-button>`
          : ""
      }`;

      return `
    <mj-hero mode="${attr(p.mode, "fixed-height")}" height="${attr(
      p.height,
      "360px"
    )}" background-url="${attr(p.backgroundUrl)}" background-width="${attr(
      p.backgroundWidth,
      theme.width
    )}" background-height="${attr(
      p.backgroundHeight,
      p.height || "360px"
    )}" background-color="${attr(
      colorValue(p.backgroundColor, "#1F2937")
    )}" background-position="${attr(
      p.backgroundPosition,
      "center center"
    )}" vertical-align="${attr(p.verticalAlign, "middle")}" padding="${attr(
      p.padding,
      "40px 30px"
    )}"${rawAttributes(p.heroAttributes)}>
      ${childContent || fallbackContent}
    </mj-hero>`;
      }

    case "coupon":
      return section(
        column(`
          <mj-text align="center" font-size="${attr(p.titleSize, "16px")}" font-weight="700" color="${attr(
            theme.textColor
          )}" padding="0 0 14px 0"${rawAttributes(p.titleAttributes)}>${richText(p.title)}</mj-text>
          ${
            p.logoUrl
              ? `<mj-image align="center" src="${attr(
                  p.logoUrl
                )}" alt="" width="140px" padding="0 0 15px 0"${rawAttributes(
                  p.logoAttributes
                )}></mj-image>`
              : ""
          }
          <mj-text align="center" font-size="11px" color="${attr(theme.textColor)}" padding="0 0 6px 0">Slevovy kod uplatnete kliknutim ZDE:</mj-text>
          <mj-button align="center" href="${attr(p.href)}" background-color="${attr(
          p.buttonBackground || theme.buttonBackground
        )}" color="${attr(p.buttonText || theme.buttonText)}" border-radius="8px" inner-padding="10px 20px"${rawAttributes(
          p.buttonAttributes
        )}>${richText(
          p.code
        )}</mj-button>
          <mj-text align="center" font-size="11px" line-height="16px" color="${attr(
            theme.mutedColor
          )}" padding="10px 0"${rawAttributes(p.conditionAttributes)}>${richText(p.condition)}</mj-text>
          <mj-text align="center" font-size="10px" color="${attr(theme.mutedColor)}" padding="0">${richText(
          p.validFrom
        )}</mj-text>
        `, { attributes: p.columnAttributes }),
        {
          backgroundColor: colorValue(p.backgroundColor, "#e9f6fc"),
          padding: p.padding || "10px 15px",
          attributes: p.sectionAttributes
        }
      );

    case "three-column": {
      const cells = [1, 2, 3]
        .map(
          (index) => `
            <td width="33.33%" style="padding: 0 8px; vertical-align: top;">
              <strong>${text(p[`title${index}`])}</strong><br />
              <span>${richText(p[`text${index}`])}</span>
            </td>`
        )
        .join("");

      if (context === "child") {
        return `<mj-table color="${attr(
          theme.textColor
        )}" font-size="14px" line-height="21px" padding="0 0 12px 0">
          <tr>${cells}</tr>
        </mj-table>`;
      }

      return section(
        [1, 2, 3]
          .map((index) =>
            column(
              `
          <mj-text font-size="16px" font-weight="700" color="${attr(
            theme.textColor
          )}" padding="0 0 8px 0">${richText(p[`title${index}`])}</mj-text>
          <mj-text font-size="14px" line-height="21px" color="${attr(
            theme.textColor
          )}" padding="0">${richText(p[`text${index}`])}</mj-text>
        `,
              { width: "33.33%", padding: "0 8px", attributes: p.columnAttributes }
            )
          )
          .join("\n"),
        {
          backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
          padding: p.padding || theme.defaultSectionPadding || "24px 30px",
          attributes: p.sectionAttributes
        }
      );
    }

    case "card": {
      const cardContent = `
        ${
          p.imageUrl
            ? `<mj-image src="${attr(
                p.imageUrl
              )}" alt="" padding="0 0 14px 0" width="520px"></mj-image>`
            : ""
        }
        <mj-text font-size="18px" font-weight="700" line-height="24px" color="${attr(
          p.textColor || theme.textColor
        )}" padding="0 0 8px 0">${richText(p.title)}</mj-text>
        <mj-text font-size="14px" line-height="22px" color="${attr(
          p.textColor || theme.textColor
        )}" padding="0">${richText(p.text)}</mj-text>
        ${
          p.ctaLabel
            ? `<mj-button href="${attr(
                p.ctaHref
              )}" background-color="${attr(
                theme.buttonBackground
              )}" color="${attr(
                theme.buttonText
              )}" border-radius="8px" inner-padding="10px 20px" padding="16px 0 0 0"${rawAttributes(
                p.buttonAttributes
              )}>${richText(p.ctaLabel)}</mj-button>`
            : ""
        }`;

      if (context === "child") {
        return `<mj-text container-background-color="${attr(
          colorValue(p.backgroundColor, "#F8FAFC")
        )}" padding="${attr(p.padding, "20px")}" color="${attr(
          p.textColor || theme.textColor
        )}">
          <strong>${richText(p.title)}</strong><br />
          ${richText(p.text)}
        </mj-text>
        ${
          p.ctaLabel
            ? `<mj-button href="${attr(
                p.ctaHref
              )}" background-color="${attr(
                theme.buttonBackground
              )}" color="${attr(theme.buttonText)}" padding="0 0 12px 0"${rawAttributes(
                p.buttonAttributes
              )}>${richText(p.ctaLabel)}</mj-button>`
            : ""
        }`;
      }

      return `
    <mj-section background-color="${attr(
      theme.sectionBackground
    )}" padding="20px 30px"${rawAttributes(p.sectionAttributes)}>
      <mj-column background-color="${attr(
        colorValue(p.backgroundColor, "#F8FAFC")
      )}" padding="${attr(p.padding, "20px")}"${rawAttributes(p.columnAttributes)}>
        ${cardContent}
      </mj-column>
    </mj-section>`;
    }

    case "quote": {
      const quoteText = `<span style="color:${attr(
        p.accentColor || theme.primaryColor
      )}; font-weight:700;">&ldquo;</span>${richText(p.quote)}<span style="color:${attr(
        p.accentColor || theme.primaryColor
      )}; font-weight:700;">&rdquo;</span>${
        p.author
          ? `<br /><span style="font-size:13px;color:${attr(theme.mutedColor)};">${text(
              p.author
            )}</span>`
          : ""
      }`;

      if (context === "child") {
        return `<mj-text container-background-color="${attr(
          colorValue(p.backgroundColor, theme.sectionBackground)
        )}" font-size="16px" line-height="24px" color="${attr(
          p.textColor || theme.textColor
        )}" padding="${attr(p.padding, "24px 30px")}"${rawAttributes(
          p.textAttributes
        )}>${quoteText}</mj-text>`;
      }

      return section(
        column(`
          <mj-text font-size="16px" line-height="24px" color="${attr(
            p.textColor || theme.textColor
          )}" padding="0"${rawAttributes(p.textAttributes)}>${quoteText}</mj-text>
        `),
        {
          backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
          padding: p.padding || theme.defaultSectionPadding,
          attributes: p.sectionAttributes
        }
      );
    }

    case "navbar": {
      const links = [1, 2, 3]
        .map((index) => ({
          label: p[`link${index}Label`],
          href: p[`link${index}Href`]
        }))
        .filter((link) => link.label && link.href);
      const navbar = `<mj-navbar base-url="${attr(p.baseUrl)}"${optionalAttr(
        "hamburger",
        p.hamburger
      )}${rawAttributes(p.navbarAttributes)}>
          ${links
            .map(
              (link) =>
                `<mj-navbar-link href="${attr(link.href)}" color="${attr(
                  p.color || theme.textColor
                )}" font-size="13px" padding="8px 12px"${rawAttributes(
                  p.linkAttributes
                )}>${text(link.label)}</mj-navbar-link>`
            )
            .join("\n")}
        </mj-navbar>`;

      if (context === "child") {
        return navbar;
      }

      return section(column(navbar), {
        backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
        padding: p.padding || "12px 30px"
      });
    }

    case "social": {
      const links = [
        { name: "facebook", label: "Facebook", href: p.facebook },
        { name: "instagram", label: "Instagram", href: p.instagram },
        { name: "web", label: "Web", href: p.web }
      ].filter((link) => link.href);
      const social = `<mj-social align="${attr(p.align, "center")}" mode="${attr(
        p.mode,
        "horizontal"
      )}" icon-size="${attr(p.iconSize, "28px")}" font-size="${attr(
        p.fontSize,
        "13px"
      )}" color="${attr(p.color || theme.textColor)}" padding="0"${rawAttributes(
        p.socialAttributes
      )}>
          ${links
            .map(
              (link) =>
                `<mj-social-element name="${attr(link.name)}" href="${attr(
                  link.href
                )}"${rawAttributes(p.elementAttributes)}>${text(
                  link.label
                )}</mj-social-element>`
            )
            .join("\n")}
        </mj-social>`;

      if (context === "child") {
        return social;
      }

      return section(column(social), {
        backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
        padding: p.padding || "16px 30px"
      });
    }

    case "table": {
      const table = `<mj-table color="${attr(
        p.color || theme.textColor
      )}" font-size="${attr(p.fontSize, "14px")}" line-height="${attr(
        p.lineHeight,
        "20px"
      )}" padding="${context === "child" ? "0 0 12px 0" : "0"}"${rawAttributes(
        p.tableAttributes
      )}>${p.rows || ""}</mj-table>`;

      if (context === "child") {
        return table;
      }

      return section(column(table), {
        backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
        padding: p.padding || "20px 30px"
      });
    }

    case "accordion": {
      const accordion = `<mj-accordion padding="0"${rawAttributes(
        p.accordionAttributes
      )}>
          ${[1, 2]
            .filter((index) => p[`title${index}`] || p[`text${index}`])
            .map(
              (index) => `
          <mj-accordion-element${rawAttributes(p.elementAttributes)}>
            <mj-accordion-title background-color="${attr(
              colorValue(p.titleBackground, "#F4F7FB")
            )}" color="${attr(p.color || theme.textColor)}" font-size="15px">${richText(
                p[`title${index}`]
              )}</mj-accordion-title>
            <mj-accordion-text background-color="${attr(
              colorValue(p.textBackground, "#ffffff")
            )}" color="${attr(p.color || theme.textColor)}" font-size="14px" line-height="21px">${richText(
                p[`text${index}`]
              )}</mj-accordion-text>
          </mj-accordion-element>`
            )
            .join("\n")}
        </mj-accordion>`;

      if (context === "child") {
        return accordion;
      }

      return section(column(accordion), {
        backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
        padding: p.padding || "20px 30px"
      });
    }

    case "carousel": {
      const images = [p.image1, p.image2, p.image3].filter(Boolean);
      const carousel = images.length
        ? `<mj-carousel${rawAttributes(p.carouselAttributes)}>
          ${images
            .map(
              (image) =>
                `<mj-carousel-image src="${attr(image)}"${optionalAttr(
                  "border-radius",
                  p.borderRadius
                )}${rawAttributes(p.imageAttributes)}></mj-carousel-image>`
            )
            .join("\n")}
        </mj-carousel>`
        : `<mj-text align="center" color="${attr(theme.mutedColor)}" padding="0">Carousel nema obrazek.</mj-text>`;

      if (context === "child") {
        return carousel;
      }

      return section(column(carousel), {
        backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
        padding: p.padding || "20px 30px"
      });
    }

    case "two-column":
      return section(
        `${column(
          `
          <mj-text font-size="18px" font-weight="700" color="${attr(theme.textColor)}" padding="0 0 8px 0">${richText(
            p.leftTitle
          )}</mj-text>
          <mj-text font-size="14px" line-height="22px" color="${attr(theme.textColor)}" padding="0">${richText(
            p.leftText
          )}</mj-text>
        `,
          { width: "50%", padding: "0 10px 0 0", attributes: p.leftColumnAttributes }
        )}
        ${column(
          `
          <mj-text font-size="18px" font-weight="700" color="${attr(theme.textColor)}" padding="0 0 8px 0">${richText(
            p.rightTitle
          )}</mj-text>
          <mj-text font-size="14px" line-height="22px" color="${attr(theme.textColor)}" padding="0">${richText(
            p.rightText
          )}</mj-text>
        `,
          { width: "50%", padding: "0 0 0 10px", attributes: p.rightColumnAttributes }
        )}`,
        {
          backgroundColor: colorValue(p.backgroundColor, theme.sectionBackground),
          padding: p.padding || theme.defaultSectionPadding || "24px 30px",
          attributes: p.sectionAttributes
        }
      );

    case "divider":
      if (context === "child") {
        return `<mj-divider border-color="${attr(
          p.color,
          "#d9e2ec"
        )}" border-width="1px" padding="12px 0"></mj-divider>`;
      }
      return `
    <mj-section background-color="${attr(theme.sectionBackground)}" padding="0 30px">
      <mj-column>
        <mj-divider border-color="${attr(p.color, "#d9e2ec")}" border-width="1px" padding="12px 0"></mj-divider>
      </mj-column>
    </mj-section>`;

    case "spacer":
      if (context === "child") {
        return `<mj-spacer height="${attr(p.height, "24px")}"></mj-spacer>`;
      }
      return `
    <mj-section background-color="${attr(theme.bodyBackground)}" padding="0">
      <mj-column>
        <mj-spacer height="${attr(p.height, "24px")}"></mj-spacer>
      </mj-column>
    </mj-section>`;

    case "raw-html":
      return p.source?.trim() ? `<mj-raw>${p.source.trim()}</mj-raw>` : "";

    case "raw-mjml":
      return p.source?.trim() || "";

    case "footer":
      return section(
        column(`
          <mj-text align="center" font-size="12px" line-height="18px" color="${attr(
            p.textColor,
            "#ffffff"
          )}" padding="0"${rawAttributes(p.textAttributes)}>${richText(p.text)}</mj-text>
        `, { attributes: p.columnAttributes }),
        {
          backgroundColor: colorValue(p.backgroundColor, theme.primaryColor),
          padding: p.padding || "20px 30px",
          attributes: p.sectionAttributes
        }
      );
  }
}

export function buildBuilderMjml(
  blocks: BuilderBlock[],
  theme: BuilderTheme,
  options: { customHead?: string; device?: BuilderRenderDevice } = {}
): string {
  const renderedBlocks = blocks
    .map((block) => renderBlock(block, theme, "root", options.device || "desktop"))
    .filter(Boolean)
    .join("\n");

  return `<mjml>
  <mj-head>
    ${theme.headTitle ? `<mj-title>${text(theme.headTitle)}</mj-title>` : ""}
    ${theme.previewText ? `<mj-preview>${text(theme.previewText)}</mj-preview>` : ""}
    ${theme.breakpoint ? `<mj-breakpoint width="${attr(theme.breakpoint)}" />` : ""}
    <mj-attributes>
      <mj-all font-family="${attr(theme.fontFamily)}"${rawAttributes(
        theme.globalAttributes
      )} />
      <mj-body background-color="${attr(theme.bodyBackground)}" width="${attr(theme.width)}" />
      <mj-section background-color="${attr(
        theme.sectionBackground
      )}" padding="${attr(theme.defaultSectionPadding)}" />
      <mj-text font-size="${attr(theme.defaultTextSize)}" line-height="${attr(
        theme.defaultLineHeight
      )}" color="${attr(theme.textColor)}" />
      <mj-button background-color="${attr(theme.buttonBackground)}" color="${attr(
        theme.buttonText
      )}" />
    </mj-attributes>
    ${options.customHead?.trim() || ""}
  </mj-head>
  <mj-body background-color="${attr(theme.bodyBackground)}" width="${attr(theme.width)}">
${renderedBlocks}
  </mj-body>
</mjml>`;
}
