// Reviewed publisher-owned RSS endpoints. All ten categories use the country's
// pool, then regional publishers. The pool is discovery only: an article still
// needs independent headline country/category evidence, its original date and
// an exact allowed HTTPS article host. Never infer relevance from this table.
// No dynamic feed URLs, publisher-wide date waivers or timestamp renewal.
export const countryPublisherFeeds = {
  "CR": [
    {
      "url": "https://ticotimes.net/feed",
      "pages": ["https://ticotimes.net/feed?paged=2", "https://ticotimes.net/feed?paged=3"],
      "name": "The Tico Times",
      "hosts": [
        "ticotimes.net"
      ]
    }
  ],
  "BR": [
    {
      "url": "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
      "name": "Agência Brasil",
      "hosts": [
        "agenciabrasil.ebc.com.br"
      ]
    },
    {
      "url": "https://g1.globo.com/rss/g1/",
      "name": "g1",
      "hosts": [
        "g1.globo.com"
      ]
    }
  ],
  "CO": [
    {
      "url": "https://colombiareports.com/feed/",
      "pages": ["https://colombiareports.com/feed/?paged=2", "https://colombiareports.com/feed/?paged=3"],
      "name": "Colombia Reports",
      "hosts": [
        "colombiareports.com"
      ]
    }
  ],
  "AR": [
    {
      "url": "https://buenosairesherald.com/feed",
      "pages": ["https://buenosairesherald.com/feed?paged=2", "https://buenosairesherald.com/feed?paged=3"],
      "name": "Buenos Aires Herald",
      "hosts": [
        "buenosairesherald.com"
      ]
    }
  ],
  "EC": [
    {
      "url": "https://www.eluniverso.com/arc/outboundfeeds/rss/?outputType=xml",
      "name": "El Universo",
      "hosts": [
        "eluniverso.com", "www.eluniverso.com"
      ]
    }
  ],
  "DO": [
    {
      "url": "https://dominicantoday.com/feed/",
      "pages": ["https://dominicantoday.com/feed/?paged=2", "https://dominicantoday.com/feed/?paged=3"],
      "name": "Dominican Today",
      "hosts": [
        "dominicantoday.com"
      ]
    }
  ],
  "MX": [
    {
      "url": "https://mexiconewsdaily.com/feed/",
      "pages": ["https://mexiconewsdaily.com/feed/?paged=2", "https://mexiconewsdaily.com/feed/?paged=3"],
      "name": "Mexico News Daily",
      "hosts": [
        "mexiconewsdaily.com"
      ]
    },
    {
      "url": "https://www.jornada.com.mx/rss/edicion.xml",
      "name": "La Jornada",
      "hosts": [
        "www.jornada.com.mx"
      ]
    }
  ],
  "HN": [
    {
      "url": "https://proceso.hn/feed/",
      "name": "Proceso Digital",
      "hosts": [
        "proceso.hn"
      ]
    }
  ],
  "PA": [
    {
      "url": "https://newsroompanama.com/feed/",
      "pages": ["https://newsroompanama.com/feed/?paged=2", "https://newsroompanama.com/feed/?paged=3"],
      "name": "Newsroom Panama",
      "hosts": [
        "newsroompanama.com"
      ]
    }
  ],
  "PY": [
    {
      "url": "https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml",
      "name": "ABC Color",
      "hosts": [
        "www.abc.com.py"
      ]
    }
  ],
  "PE": [
    {
      "url": "https://rpp.pe/rss",
      "name": "RPP",
      "hosts": [
        "rpp.pe"
      ]
    },
    {
      "url": "https://gestion.pe/arc/outboundfeeds/rss/?outputType=xml",
      "name": "Gestión",
      "hosts": [
        "gestion.pe"
      ]
    }
  ],
  "PR": [
    {
      "url": "https://pasquines.us/feed/",
      "pages": ["https://pasquines.us/feed/?paged=2", "https://pasquines.us/feed/?paged=3"],
      "name": "Pasquines",
      "hosts": [
        "pasquines.us"
      ]
    },
    {
      "url": "https://www.periodicolaperla.com/feed/",
      "name": "La Perla del Sur",
      "hosts": [
        "www.periodicolaperla.com"
      ]
    }
  ],
  "UY": [
    {
      "url": "https://www.montevideo.com.uy/anxml.aspx?58",
      "name": "Montevideo Portal",
      "hosts": [
        "www.montevideo.com.uy"
      ]
    }
  ],
  "NI": [
    {
      "url": "https://confidencial.digital/feed/",
      "name": "Confidencial",
      "hosts": [
        "confidencial.digital"
      ]
    }
  ],
  "VE": [
    {
      "url": "https://www.elnacional.com/feed/",
      "name": "EL NACIONAL",
      "hosts": [
        "www.elnacional.com"
      ]
    }
  ],
  "SR": [
    {
      "url": "https://www.waterkant.net/feed/",
      "pages": ["https://www.waterkant.net/feed/?paged=2", "https://www.waterkant.net/feed/?paged=3"],
      "name": "Waterkant",
      "hosts": [
        "www.waterkant.net"
      ]
    },
    {
      "url": "https://www.srherald.com/feed/",
      "pages": ["https://www.srherald.com/feed/?paged=2", "https://www.srherald.com/feed/?paged=3"],
      "name": "Suriname Herald",
      "hosts": [
        "www.srherald.com"
      ]
    },
    {
      "url": "https://www.dbsuriname.com/feed/",
      "pages": ["https://www.dbsuriname.com/feed/?paged=2", "https://www.dbsuriname.com/feed/?paged=3"],
      "name": "Dagblad Suriname",
      "hosts": [
        "www.dbsuriname.com"
      ]
    },
    {
      "url": "https://dwtonline.com/feed/",
      "pages": ["https://dwtonline.com/feed/?paged=2", "https://dwtonline.com/feed/?paged=3"],
      "name": "De Ware Tijd",
      "hosts": [
        "dwtonline.com"
      ]
    }
  ],
  "GY": [
    {
      "url": "https://guyanachronicle.com/feed/",
      "pages": ["https://guyanachronicle.com/feed/?paged=2", "https://guyanachronicle.com/feed/?paged=3"],
      "name": "Guyana Chronicle",
      "hosts": [
        "guyanachronicle.com"
      ]
    },
    {
      "url": "https://demerarawaves.com/feed/",
      "pages": ["https://demerarawaves.com/feed/?paged=2", "https://demerarawaves.com/feed/?paged=3"],
      "name": "Demerara Waves Online News- Guyana",
      "hosts": [
        "demerarawaves.com"
      ]
    },
    {
      "url": "https://www.inewsguyana.com/feed/",
      "pages": ["https://www.inewsguyana.com/feed/?paged=2", "https://www.inewsguyana.com/feed/?paged=3"],
      "name": "INews Guyana",
      "hosts": [
        "inewsguyana.com"
      ]
    }
  ],
  "TT": [
    {
      "url": "https://www.cnc3.co.tt/feed/",
      "pages": ["https://www.cnc3.co.tt/feed/?paged=2", "https://www.cnc3.co.tt/feed/?paged=3"],
      "name": "CNC3",
      "hosts": [
        "www.cnc3.co.tt"
      ]
    },
    {
      "url": "https://www.ttt.live/feed/",
      "pages": ["https://www.ttt.live/feed/?paged=2", "https://www.ttt.live/feed/?paged=3"],
      "name": "TTT News",
      "hosts": [
        "www.ttt.live"
      ]
    }
  ],
  "GF": [
    {
      "url": "https://www.franceguyane.fr/actualite/fil-info/rss.xml",
      "name": "franceguyane.fr",
      "hosts": [
        "www.franceguyane.fr"
      ]
    },
    {
      "url": "https://api.outremers360.com/rss/fil-info.xml",
      "name": "Outremers360",
      "hosts": [
        "outremers360.com"
      ]
    }
  ],
  "BO": [
    {
      "url": "https://www.opinion.com.bo/rss",
      "name": "Opinión Bolivia",
      "hosts": [
        "www.opinion.com.bo"
      ]
    },
    {
      "url": "https://www.eldiario.net/portal/feed/",
      "pages": ["https://www.eldiario.net/portal/feed/?paged=2", "https://www.eldiario.net/portal/feed/?paged=3"],
      "name": "El Diario Bolivia",
      "hosts": [
        "www.eldiario.net"
      ]
    }
  ],
  "CL": [
    {
      "url": "https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml",
      "name": "La Tercera",
      "hosts": [
        "www.latercera.com"
      ]
    },
    {
      "url": "https://www.elciudadano.com/feed/",
      "pages": ["https://www.elciudadano.com/feed/?paged=2", "https://www.elciudadano.com/feed/?paged=3"],
      "name": "El Ciudadano",
      "hosts": [
        "www.elciudadano.com"
      ]
    }
  ],
  "CU": [
    {
      "url": "https://diariodecuba.com/rss.xml",
      "name": "Diario de Cuba",
      "hosts": [
        "diariodecuba.com"
      ]
    }
  ],
  "SV": [
    {
      "url": "https://www.diariocolatino.com/feed/",
      "pages": ["https://www.diariocolatino.com/feed/?paged=2", "https://www.diariocolatino.com/feed/?paged=3"],
      "name": "Diario Co Latino",
      "hosts": [
        "www.diariocolatino.com"
      ]
    }
  ],
  "GT": [
    {
      "url": "https://emisorasunidas.com/feed/",
      "name": "Emisoras Unidas",
      "hosts": [
        "emisorasunidas.com"
      ]
    }
  ]
};

export const regionalPublisherFeeds = [
  {
    "url": "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml",
    "name": "BBC News",
    "hosts": [
      "www.bbc.co.uk"
    ]
  },
  {
    "url": "https://www.france24.com/en/americas/rss",
    "name": "France 24",
    "hosts": [
      "www.france24.com"
    ]
  },
  {
    "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada",
    "name": "EL PAÍS",
    "hosts": [
      "elpais.com",
      "cincodias.elpais.com",
      "english.elpais.com"
    ]
  }
];

const sectionPublisherFeeds = {
  "TT/politics": [
    {
      "url": "https://www.ttt.live/category/news/government-news/feed/",
      "name": "TTT News",
      "hosts": [
        "www.ttt.live"
      ]
    },
    {
      "url": "https://www.ttt.live/category/politics/feed/",
      "name": "TTT News",
      "hosts": [
        "www.ttt.live"
      ]
    }
  ],
  "GF/economy": [
    {
      "url": "https://www.franceguyane.fr/actualite/economie-consommation/rss.xml",
      "name": "franceguyane.fr",
      "hosts": [
        "www.franceguyane.fr"
      ]
    }
  ]
};

export function publisherSourcesFor(country, feed) {
  const national = countryPublisherFeeds[country.id];
  if (!national) return [];
  return [...(sectionPublisherFeeds[`${country.id}/${feed.key}`] ?? []),
    ...national, ...national.flatMap(source => (source.pages ?? []).map(url => ({ ...source, url }))),
    ...regionalPublisherFeeds];
}
