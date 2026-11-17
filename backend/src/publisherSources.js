// Reviewed publisher-owned news endpoints. All ten categories use the country's
// pool, then regional publishers. The pool is discovery only: an article still
// needs independent headline country/category evidence, its original date and
// an exact allowed HTTPS article host. Never infer relevance from this table.
// No dynamic feed URLs, publisher-wide date waivers or timestamp renewal.
export const countryPublisherFeeds = {
  "CR": [
    {
      "url": "https://www.infobae.com/arc/outboundfeeds/rss/category/costa-rica/",
      "name": "Infobae",
      "hosts": [
        "www.infobae.com"
      ]
    },
    {
      "url": "https://crprensa.com/wp-json/wp/v2/posts?search=Costa%20Rica",
      "name": "CRprensa.com",
      "hosts": [
        "crprensa.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://elmundo.cr/wp-json/wp/v2/posts",
      "name": "El Mundo Costa Rica",
      "hosts": [
        "elmundo.cr"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://semanariouniversidad.com/wp-json/wp/v2/posts",
      "name": "Semanario Universidad",
      "hosts": [
        "semanariouniversidad.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://observador.cr/wp-json/wp/v2/posts",
      "name": "El Observador Costa Rica",
      "hosts": [
        "observador.cr"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://ticotimes.net/feed",
      "pages": [
        "https://ticotimes.net/feed?paged=2",
        "https://ticotimes.net/feed?paged=3"
      ],
      "name": "The Tico Times",
      "hosts": [
        "ticotimes.net"
      ]
    },
    {
      "url": "https://ticotimes.net/wp-json/wp/v2/posts",
      "name": "The Tico Times",
      "hosts": [
        "ticotimes.net"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://delfino.cr/feed",
      "name": "Delfino",
      "hosts": [
        "delfino.cr"
      ]
    },
    {
      "url": "https://observador.cr/feed/",
      "name": "El Observador Costa Rica",
      "hosts": [
        "observador.cr"
      ]
    },
    {
      "url": "https://www.nacion.com/arc/outboundfeeds/rss/?outputType=xml",
      "name": "La Nación Costa Rica",
      "hosts": [
        "www.nacion.com"
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
    },
    {
      "url": "https://www.brasildefato.com.br/feed/",
      "name": "Brasil de Fato",
      "hosts": [
        "www.brasildefato.com.br"
      ]
    },
    {
      "url": "https://www.brasildefato.com.br/wp-json/wp/v2/posts",
      "name": "Brasil de Fato",
      "hosts": [
        "www.brasildefato.com.br"
      ],
      "kind": "wordpress"
    }
  ],
  "CO": [
    {
      "url": "https://colombiareports.com/feed/",
      "pages": [
        "https://colombiareports.com/feed/?paged=2",
        "https://colombiareports.com/feed/?paged=3"
      ],
      "name": "Colombia Reports",
      "hosts": [
        "colombiareports.com"
      ]
    },
    {
      "url": "https://colombiareports.com/wp-json/wp/v2/posts",
      "name": "Colombia Reports",
      "hosts": [
        "colombiareports.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.elpais.com.co/arc/outboundfeeds/rss/?outputType=xml",
      "name": "El País Cali",
      "hosts": [
        "www.elpais.com.co"
      ]
    },
    {
      "url": "https://portalgeek.co/feed/",
      "name": "Portal Geek",
      "hosts": [
        "portalgeek.co"
      ]
    },
    {
      "url": "https://portalgeek.co/wp-json/wp/v2/posts",
      "name": "Portal Geek",
      "hosts": [
        "portalgeek.co"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.infobae.com/arc/outboundfeeds/rss/category/colombia/",
      "name": "Infobae",
      "hosts": [
        "www.infobae.com"
      ]
    }
  ],
  "AR": [
    {
      "url": "https://buenosairesherald.com/feed",
      "pages": [
        "https://buenosairesherald.com/feed?paged=2",
        "https://buenosairesherald.com/feed?paged=3"
      ],
      "name": "Buenos Aires Herald",
      "hosts": [
        "buenosairesherald.com"
      ]
    },
    {
      "url": "https://buenosairesherald.com/wp-json/wp/v2/posts",
      "name": "Buenos Aires Herald",
      "hosts": [
        "buenosairesherald.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.ambito.com/rss/pages/politica.xml",
      "name": "Ámbito",
      "hosts": [
        "www.ambito.com"
      ]
    }
  ],
  "EC": [
    {
      "url": "https://www.elcomercio.com/wp-json/wp/v2/posts",
      "name": "El Comercio Ecuador",
      "hosts": [
        "www.elcomercio.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.eluniverso.com/arc/outboundfeeds/rss/?outputType=xml",
      "name": "El Universo",
      "hosts": [
        "eluniverso.com",
        "www.eluniverso.com"
      ]
    },
    {
      "url": "https://www.ecuadorinmediato.com/feed.xml",
      "name": "Ecuador Inmediato",
      "hosts": [
        "www.ecuadorinmediato.com"
      ]
    },
    {
      "url": "https://www.elcomercio.com/feed/",
      "name": "El Comercio Ecuador",
      "hosts": [
        "www.elcomercio.com"
      ]
    }
  ],
  "DO": [
    {
      "url": "https://dominicantoday.com/feed/",
      "pages": [
        "https://dominicantoday.com/feed/?paged=2",
        "https://dominicantoday.com/feed/?paged=3"
      ],
      "name": "Dominican Today",
      "hosts": [
        "dominicantoday.com"
      ]
    },
    {
      "url": "https://dominicantoday.com/wp-json/wp/v2/posts",
      "name": "Dominican Today",
      "hosts": [
        "dominicantoday.com"
      ],
      "kind": "wordpress"
    }
  ],
  "MX": [
    {
      "url": "https://mexiconewsdaily.com/feed/",
      "pages": [
        "https://mexiconewsdaily.com/feed/?paged=2",
        "https://mexiconewsdaily.com/feed/?paged=3"
      ],
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
    },
    {
      "url": "https://mexiconewsdaily.com/wp-json/wp/v2/posts",
      "name": "Mexico News Daily",
      "hosts": [
        "mexiconewsdaily.com"
      ],
      "kind": "wordpress"
    }
  ],
  "HN": [
    {
      "url": "https://proceso.hn/feed/",
      "name": "Proceso Digital",
      "hosts": [
        "proceso.hn"
      ]
    },
    {
      "url": "https://criterio.hn/feed/",
      "name": "Criterio",
      "hosts": [
        "criterio.hn"
      ]
    },
    {
      "url": "https://www.hondudiario.com/feed/",
      "name": "Hondudiario",
      "hosts": [
        "www.hondudiario.com"
      ]
    },
    {
      "url": "https://confidencialhn.com/feed/",
      "name": "Confidencial Honduras",
      "hosts": [
        "confidencialhn.com"
      ]
    },
    {
      "url": "https://criterio.hn/wp-json/wp/v2/posts",
      "name": "Criterio",
      "hosts": [
        "criterio.hn"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.hondudiario.com/wp-json/wp/v2/posts",
      "name": "Hondudiario",
      "hosts": [
        "www.hondudiario.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://confidencialhn.com/wp-json/wp/v2/posts",
      "name": "Confidencial Honduras",
      "hosts": [
        "confidencialhn.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://hch.tv/wp-json/wp/v2/posts?search=Honduras",
      "name": "HCH",
      "hosts": [
        "hch.tv"
      ],
      "kind": "wordpress"
    }
  ],
  "PA": [
    {
      "url": "https://newsroompanama.com/feed/",
      "pages": [
        "https://newsroompanama.com/feed/?paged=2",
        "https://newsroompanama.com/feed/?paged=3"
      ],
      "name": "Newsroom Panama",
      "hosts": [
        "newsroompanama.com"
      ]
    },
    {
      "url": "https://newsroompanama.com/wp-json/wp/v2/posts",
      "name": "Newsroom Panama",
      "hosts": [
        "newsroompanama.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.prensa.com/arc/outboundfeeds/rss/?outputType=xml",
      "name": "La Prensa Panamá",
      "hosts": [
        "www.prensa.com"
      ]
    }
  ],
  "PY": [
    {
      "url": "https://www.ultimahora.com/arte-y-espectaculos.rss",
      "name": "Última Hora",
      "hosts": [
        "www.ultimahora.com"
      ]
    },
    {
      "url": "https://mediosdelestado.gov.py/wp-json/wp/v2/posts?search=Paraguay",
      "name": "Medios del Estado Paraguay",
      "hosts": [
        "mediosdelestado.gov.py"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://mediosdelestado.gov.py/feed/",
      "name": "Medios del Estado Paraguay",
      "hosts": [
        "mediosdelestado.gov.py"
      ]
    },
    {
      "url": "https://elnacional.com.py/feed/",
      "name": "El Nacional Paraguay",
      "hosts": [
        "elnacional.com.py"
      ]
    },
    {
      "url": "https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml",
      "name": "ABC Color",
      "hosts": [
        "www.abc.com.py"
      ]
    },
    {
      "url": "https://www.lanacion.com.py/arc/outboundfeeds/rss/?outputType=xml",
      "name": "La Nación Paraguay",
      "hosts": [
        "www.lanacion.com.py"
      ]
    }
  ],
  "PE": [
    {
      "url": "https://www.masgamers.com/wp-json/wp/v2/posts",
      "name": "MasGamers",
      "hosts": [
        "www.masgamers.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.peru-retail.com/wp-json/wp/v2/posts",
      "name": "Perú Retail",
      "hosts": [
        "www.peru-retail.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://andina.pe/agencia/rss.aspx",
      "name": "Agencia Andina",
      "hosts": [
        "andina.pe"
      ]
    },
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
    },
    {
      "url": "https://andina.pe/ingles/rss.aspx",
      "name": "Agencia Andina",
      "hosts": [
        "andina.pe"
      ]
    },
    {
      "url": "https://www.infobae.com/arc/outboundfeeds/rss/category/peru/",
      "name": "Infobae",
      "hosts": [
        "www.infobae.com"
      ]
    }
  ],
  "PR": [
    {
      "url": "https://pasquines.us/feed/",
      "pages": [
        "https://pasquines.us/feed/?paged=2",
        "https://pasquines.us/feed/?paged=3"
      ],
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
    },
    {
      "url": "https://www.periodicolaperla.com/wp-json/wp/v2/posts",
      "name": "La Perla del Sur",
      "hosts": [
        "www.periodicolaperla.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.metro.pr/arc/outboundfeeds/rss/?outputType=xml",
      "name": "Metro Puerto Rico",
      "hosts": [
        "www.metro.pr"
      ]
    },
    {
      "url": "https://www.elnuevodia.com/arc/outboundfeeds/rss/?outputType=xml",
      "name": "El Nuevo Día",
      "hosts": [
        "www.elnuevodia.com"
      ]
    },
    {
      "url": "https://www.primerahora.com/arc/outboundfeeds/rss/?outputType=xml",
      "name": "Primera Hora",
      "hosts": [
        "www.primerahora.com"
      ]
    },
    {
      "url": "https://periodismoinvestigativo.com/feed/",
      "name": "Centro de Periodismo Investigativo",
      "hosts": [
        "periodismoinvestigativo.com"
      ]
    },
    {
      "url": "https://prpop.org/feed/",
      "name": "Fundación Nacional para la Cultura Popular",
      "hosts": [
        "prpop.org"
      ]
    },
    {
      "url": "https://prpop.org/wp-json/wp/v2/posts",
      "name": "Fundación Nacional para la Cultura Popular",
      "hosts": [
        "prpop.org"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://noticel.com/wp-json/wp/v2/posts",
      "name": "NotiCel",
      "hosts": [
        "noticel.com"
      ],
      "kind": "wordpress"
    }
  ],
  "UY": [
    {
      "url": "https://metronomo.uy/wp-json/wp/v2/posts",
      "name": "Metrónomo",
      "hosts": [
        "metronomo.uy"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://cooltivarte.com/portal/wp-json/wp/v2/posts",
      "name": "Cooltivarte",
      "hosts": [
        "cooltivarte.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://doxa.uy/wp-json/wp/v2/posts",
      "name": "Doxa",
      "hosts": [
        "doxa.uy"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.carasycaretas.com.uy/rss/pages/home.xml",
      "name": "Caras y Caretas",
      "hosts": [
        "www.carasycaretas.com.uy"
      ]
    },
    {
      "url": "https://www.montevideo.com.uy/anxml.aspx?58",
      "name": "Montevideo Portal",
      "hosts": [
        "www.montevideo.com.uy"
      ]
    },
    {
      "url": "https://ladiaria.com.uy/feeds/articulos/",
      "name": "La Diaria",
      "hosts": [
        "ladiaria.com.uy"
      ]
    },
    {
      "url": "https://uruguayaldia.com.uy/wp-json/wp/v2/posts?search=Uruguay",
      "name": "Uruguay al Día",
      "hosts": [
        "uruguayaldia.com.uy"
      ],
      "kind": "wordpress"
    }
  ],
  "NI": [
    {
      "url": "https://barricada.com.ni/wp-json/wp/v2/posts",
      "name": "Barricada",
      "hosts": [
        "barricada.com.ni"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.canal4.com.ni/wp-json/wp/v2/posts",
      "name": "Canal 4 Nicaragua",
      "hosts": [
        "www.canal4.com.ni"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://confidencial.digital/feed/",
      "name": "Confidencial",
      "hosts": [
        "confidencial.digital"
      ]
    },
    {
      "url": "https://confidencial.digital/wp-json/wp/v2/posts",
      "name": "Confidencial",
      "hosts": [
        "confidencial.digital"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://nicaraguainvestiga.com/feed/",
      "name": "Nicaragua Investiga",
      "hosts": [
        "nicaraguainvestiga.com"
      ]
    },
    {
      "url": "https://nicaraguainvestiga.com/wp-json/wp/v2/posts",
      "name": "Nicaragua Investiga",
      "hosts": [
        "nicaraguainvestiga.com"
      ],
      "kind": "wordpress"
    }
  ],
  "VE": [
    {
      "url": "https://www.elnacional.com/feed/",
      "name": "EL NACIONAL",
      "hosts": [
        "www.elnacional.com"
      ]
    },
    {
      "url": "https://www.elnacional.com/wp-json/wp/v2/posts",
      "name": "EL NACIONAL",
      "hosts": [
        "www.elnacional.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://elpitazo.net/feed/",
      "name": "El Pitazo",
      "hosts": [
        "elpitazo.net"
      ]
    },
    {
      "url": "https://elpitazo.net/wp-json/wp/v2/posts",
      "name": "El Pitazo",
      "hosts": [
        "elpitazo.net"
      ],
      "kind": "wordpress"
    }
  ],
  "SR": [
    {
      "url": "https://gov.sr/wp-json/wp/v2/posts",
      "name": "Government of Suriname",
      "hosts": [
        "gov.sr"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.waterkant.net/feed/",
      "pages": [
        "https://www.waterkant.net/feed/?paged=2",
        "https://www.waterkant.net/feed/?paged=3"
      ],
      "name": "Waterkant",
      "hosts": [
        "www.waterkant.net"
      ]
    },
    {
      "url": "https://www.srherald.com/feed/",
      "pages": [
        "https://www.srherald.com/feed/?paged=2",
        "https://www.srherald.com/feed/?paged=3"
      ],
      "name": "Suriname Herald",
      "hosts": [
        "www.srherald.com"
      ]
    },
    {
      "url": "https://www.dbsuriname.com/feed/",
      "pages": [
        "https://www.dbsuriname.com/feed/?paged=2",
        "https://www.dbsuriname.com/feed/?paged=3"
      ],
      "name": "Dagblad Suriname",
      "hosts": [
        "www.dbsuriname.com"
      ]
    },
    {
      "url": "https://dwtonline.com/feed/",
      "pages": [
        "https://dwtonline.com/feed/?paged=2",
        "https://dwtonline.com/feed/?paged=3"
      ],
      "name": "De Ware Tijd",
      "hosts": [
        "dwtonline.com"
      ]
    },
    {
      "url": "https://www.waterkant.net/wp-json/wp/v2/posts",
      "name": "Waterkant",
      "hosts": [
        "www.waterkant.net"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.srherald.com/wp-json/wp/v2/posts",
      "name": "Suriname Herald",
      "hosts": [
        "www.srherald.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.dbsuriname.com/wp-json/wp/v2/posts",
      "name": "Dagblad Suriname",
      "hosts": [
        "www.dbsuriname.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://dwtonline.com/wp-json/wp/v2/posts",
      "name": "De Ware Tijd",
      "hosts": [
        "dwtonline.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://keynews.sr/wp-json/wp/v2/posts",
      "name": "Key News Suriname",
      "hosts": [
        "keynews.sr"
      ],
      "kind": "wordpress"
    }
  ],
  "GY": [
    {
      "url": "https://kaieteurnewsonline.com/wp-json/wp/v2/posts",
      "name": "Kaieteur News",
      "hosts": [
        "kaieteurnewsonline.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://guyanachronicle.com/feed/",
      "pages": [
        "https://guyanachronicle.com/feed/?paged=2",
        "https://guyanachronicle.com/feed/?paged=3"
      ],
      "name": "Guyana Chronicle",
      "hosts": [
        "guyanachronicle.com"
      ]
    },
    {
      "url": "https://demerarawaves.com/feed/",
      "pages": [
        "https://demerarawaves.com/feed/?paged=2",
        "https://demerarawaves.com/feed/?paged=3"
      ],
      "name": "Demerara Waves Online News- Guyana",
      "hosts": [
        "demerarawaves.com"
      ]
    },
    {
      "url": "https://www.inewsguyana.com/feed/",
      "pages": [
        "https://www.inewsguyana.com/feed/?paged=2",
        "https://www.inewsguyana.com/feed/?paged=3"
      ],
      "name": "INews Guyana",
      "hosts": [
        "inewsguyana.com",
        "www.inewsguyana.com"
      ]
    },
    {
      "url": "https://demerarawaves.com/wp-json/wp/v2/posts",
      "name": "Demerara Waves Online News- Guyana",
      "hosts": [
        "demerarawaves.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://dpi.gov.gy/feed/",
      "name": "DPI Guyana",
      "hosts": [
        "dpi.gov.gy"
      ]
    },
    {
      "url": "https://www.inewsguyana.com/wp-json/wp/v2/posts",
      "name": "INews Guyana",
      "hosts": [
        "inewsguyana.com",
        "www.inewsguyana.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://dpi.gov.gy/wp-json/wp/v2/posts",
      "name": "DPI Guyana",
      "hosts": [
        "dpi.gov.gy"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://guyanatimesgy.com/feed/",
      "name": "Guyana Times",
      "hosts": [
        "guyanatimesgy.com"
      ]
    },
    {
      "url": "https://guyanatimesgy.com/wp-json/wp/v2/posts",
      "name": "Guyana Times",
      "hosts": [
        "guyanatimesgy.com"
      ],
      "kind": "wordpress"
    }
  ],
  "TT": [
    {
      "url": "https://www.cnc3.co.tt/feed/",
      "pages": [
        "https://www.cnc3.co.tt/feed/?paged=2",
        "https://www.cnc3.co.tt/feed/?paged=3"
      ],
      "name": "CNC3",
      "hosts": [
        "www.cnc3.co.tt"
      ]
    },
    {
      "url": "https://www.ttt.live/feed/",
      "pages": [
        "https://www.ttt.live/feed/?paged=2",
        "https://www.ttt.live/feed/?paged=3"
      ],
      "name": "TTT News",
      "hosts": [
        "www.ttt.live"
      ]
    },
    {
      "url": "https://www.ttt.live/wp-json/wp/v2/posts",
      "name": "TTT News",
      "hosts": [
        "www.ttt.live"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://ctu.int/feed/",
      "name": "Caribbean Telecommunications Union",
      "hosts": [
        "ctu.int"
      ]
    },
    {
      "url": "https://news.fundsforngos.org/wp-json/wp/v2/posts",
      "name": "fundsforNGOs News",
      "hosts": [
        "news.fundsforngos.org"
      ],
      "kind": "wordpress"
    }
  ],
  "GF": [
    {
      "url": "https://www.franceguyane.fr/actualite/economie-consommation/rss.xml",
      "name": "franceguyane.fr",
      "hosts": [
        "www.franceguyane.fr"
      ]
    },
    {
      "url": "https://api.outremers360.com/api/articles",
      "name": "Outremers360",
      "hosts": [
        "outremers360.com"
      ],
      "kind": "outremers"
    },
    {
      "url": "https://www.karibinfo.com/wp-json/wp/v2/posts?search=Guyane",
      "name": "KARIBINFO",
      "hosts": [
        "www.karibinfo.com"
      ],
      "kind": "wordpress"
    },
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
    },
    {
      "url": "https://la1ere.franceinfo.fr/guyane/actu/rss",
      "name": "Outre-mer La 1ère",
      "hosts": [
        "la1ere.franceinfo.fr"
      ]
    },
    {
      "url": "https://www.guyaweb.com/feed/",
      "name": "Guyaweb",
      "hosts": [
        "www.guyaweb.com"
      ]
    },
    {
      "url": "https://www.franceguyane.fr/actualite/politique/rss.xml",
      "name": "franceguyane.fr",
      "hosts": [
        "www.franceguyane.fr"
      ]
    },
    {
      "url": "https://www.franceguyane.fr/actualite/sports/rss.xml",
      "name": "franceguyane.fr",
      "hosts": [
        "www.franceguyane.fr"
      ]
    },
    {
      "url": "https://www.franceguyane.fr/actualite/faitsdivers/rss.xml",
      "name": "franceguyane.fr",
      "hosts": [
        "www.franceguyane.fr"
      ]
    },
    {
      "url": "https://www.franceguyane.fr/actualite/culture-et-patrimoine/rss.xml",
      "name": "franceguyane.fr",
      "hosts": [
        "www.franceguyane.fr"
      ]
    }
  ],
  "BO": [
    {
      "url": "https://elmundo.com.bo/wp-json/wp/v2/posts",
      "name": "El Mundo Bolivia",
      "hosts": [
        "elmundo.com.bo"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://movidadealtura.com/wp-json/wp/v2/posts",
      "name": "Movida de Altura",
      "hosts": [
        "movidadealtura.com"
      ],
      "kind": "wordpress"
    },
    {
      "url": "https://www.opinion.com.bo/rss",
      "name": "Opinión Bolivia",
      "hosts": [
        "www.opinion.com.bo"
      ]
    },
    {
      "url": "https://www.eldiario.net/portal/feed/",
      "pages": [
        "https://www.eldiario.net/portal/feed/?paged=2",
        "https://www.eldiario.net/portal/feed/?paged=3"
      ],
      "name": "El Diario Bolivia",
      "hosts": [
        "www.eldiario.net"
      ]
    },
    {
      "url": "https://www.bolivia.com/rss/",
      "name": "Bolivia.com",
      "hosts": [
        "www.bolivia.com"
      ]
    },
    {
      "url": "https://eju.tv/feed/",
      "name": "eju.tv",
      "hosts": [
        "eju.tv"
      ]
    },
    {
      "url": "https://www.bolivia.com/rss/entretenimiento/",
      "name": "Bolivia.com",
      "hosts": [
        "www.bolivia.com"
      ]
    },
    {
      "url": "https://www.eldiario.net/portal/feed/?s=Bolivia",
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
      "pages": [
        "https://www.elciudadano.com/feed/?paged=2",
        "https://www.elciudadano.com/feed/?paged=3"
      ],
      "name": "El Ciudadano",
      "hosts": [
        "www.elciudadano.com"
      ]
    },
    {
      "url": "https://www.cooperativa.cl/noticias/site/tax/port/all/rss____1.xml",
      "name": "Cooperativa",
      "hosts": [
        "www.cooperativa.cl"
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
    },
    {
      "url": "https://www.cibercuba.com/rss.xml",
      "name": "CiberCuba",
      "hosts": [
        "www.cibercuba.com"
      ]
    },
    {
      "url": "https://www.granma.cu/feed",
      "name": "Granma",
      "hosts": [
        "www.granma.cu"
      ]
    },
    {
      "url": "https://www.escambray.cu/feed/",
      "name": "Escambray",
      "hosts": [
        "www.escambray.cu"
      ]
    }
  ],
  "SV": [
    {
      "url": "https://www.diariocolatino.com/feed/",
      "pages": [
        "https://www.diariocolatino.com/feed/?paged=2",
        "https://www.diariocolatino.com/feed/?paged=3"
      ],
      "name": "Diario Co Latino",
      "hosts": [
        "www.diariocolatino.com"
      ]
    },
    {
      "url": "https://www.diariocolatino.com/wp-json/wp/v2/posts",
      "name": "Diario Co Latino",
      "hosts": [
        "www.diariocolatino.com"
      ],
      "kind": "wordpress"
    }
  ],
  "GT": [
    {
      "url": "https://emisorasunidas.com/feed/",
      "name": "Emisoras Unidas",
      "hosts": [
        "emisorasunidas.com"
      ]
    },
    {
      "url": "https://prensacomunitaria.org/feed/",
      "name": "Prensa Comunitaria",
      "hosts": [
        "prensacomunitaria.org"
      ]
    },
    {
      "url": "https://prensacomunitaria.org/wp-json/wp/v2/posts",
      "name": "Prensa Comunitaria",
      "hosts": [
        "prensacomunitaria.org"
      ],
      "kind": "wordpress"
    }
  ]
};

export const regionalPublisherFeeds = [
  {
    "url": "https://www.infobae.com/arc/outboundfeeds/rss/category/america/america-latina/",
    "name": "Infobae",
    "hosts": [
      "www.infobae.com"
    ]
  },
  {
    "url": "https://www.enter.co/wp-json/wp/v2/posts",
    "name": "ENTER.CO",
    "hosts": [
      "www.enter.co"
    ],
    "kind": "wordpress",
    "countrySearch": true
  },
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
  },
  {
    "url": "https://www.prensa-latina.cu/feed/",
    "name": "Prensa Latina",
    "hosts": [
      "www.prensa-latina.cu"
    ]
  },
  {
    "url": "https://www.infobae.com/arc/outboundfeeds/rss/",
    "name": "Infobae",
    "hosts": [
      "www.infobae.com"
    ]
  },
  {
    "url": "https://ipsnoticias.net/feed/",
    "name": "IPS",
    "hosts": [
      "ipsnoticias.net"
    ]
  },
  {
    "url": "https://www.france24.com/es/am%C3%A9rica-latina/rss",
    "name": "France 24",
    "hosts": [
      "www.france24.com"
    ]
  },
  {
    "url": "https://en.mercopress.com/rss",
    "name": "MercoPress",
    "hosts": [
      "en.mercopress.com"
    ]
  },
  {
    "url": "https://es.mercopress.com/rss",
    "name": "MercoPress",
    "hosts": [
      "es.mercopress.com"
    ]
  },
  {
    "url": "https://www.prensa-latina.cu/wp-json/wp/v2/posts",
    "name": "Prensa Latina",
    "hosts": [
      "www.prensa-latina.cu"
    ],
    "kind": "wordpress",
    "countrySearch": true
  },
  {
    "url": "https://ipsnoticias.net/wp-json/wp/v2/posts",
    "name": "IPS",
    "hosts": [
      "ipsnoticias.net"
    ],
    "kind": "wordpress",
    "countrySearch": true
  },
  {
    "url": "https://efe.com/wp-json/wp/v2/posts",
    "name": "Agencia EFE",
    "hosts": [
      "efe.com"
    ],
    "kind": "wordpress",
    "countrySearch": true
  },
  {
    "url": "https://www.rfi.fr/fr/am%C3%A9riques/rss",
    "name": "RFI",
    "hosts": [
      "www.rfi.fr"
    ]
  },
  {
    "url": "https://www.resumenlatinoamericano.org/feed/",
    "name": "Resumen Latinoamericano",
    "hosts": [
      "www.resumenlatinoamericano.org"
    ]
  },
  {
    "url": "https://www.ibermusicas.org/index.php/feed/",
    "name": "Ibermúsicas",
    "hosts": [
      "www.ibermusicas.org"
    ]
  },
  {
    "url": "https://www.ibermusicas.org/index.php/wp-json/wp/v2/posts",
    "name": "Ibermúsicas",
    "hosts": [
      "www.ibermusicas.org"
    ],
    "kind": "wordpress",
    "countrySearch": true
  },
  {
    "url": "https://www.resumenlatinoamericano.org/wp-json/wp/v2/posts",
    "name": "Resumen Latinoamericano",
    "hosts": [
      "www.resumenlatinoamericano.org"
    ],
    "kind": "wordpress",
    "countrySearch": true
  },
  {
    "url": "https://www.infobae.com/arc/outboundfeeds/rss/category/cultura/",
    "name": "Infobae",
    "hosts": [
      "www.infobae.com"
    ]
  },
  {
    "url": "https://www.infobae.com/arc/outboundfeeds/rss/category/tecno/",
    "name": "Infobae",
    "hosts": [
      "www.infobae.com"
    ]
  },
  {
    "url": "https://www.infobae.com/arc/outboundfeeds/rss/category/america/",
    "name": "Infobae",
    "hosts": [
      "www.infobae.com"
    ]
  },
  {
    "url": "https://www.newsamericasnow.com/wp-json/wp/v2/posts",
    "name": "News Americas Now",
    "hosts": [
      "www.newsamericasnow.com"
    ],
    "kind": "wordpress",
    "countrySearch": true,
    "queryLanguage": "en"
  },
  {
    "url": "https://havanatimes.org/wp-json/wp/v2/posts",
    "name": "Havana Times",
    "hosts": [
      "havanatimes.org"
    ],
    "kind": "wordpress",
    "countrySearch": true,
    "queryLanguage": "en"
  },
  {
    "url": "https://caribbeannewsglobal.com/wp-json/wp/v2/posts",
    "name": "Caribbean News Global",
    "hosts": [
      "caribbeannewsglobal.com"
    ],
    "kind": "wordpress",
    "countrySearch": true,
    "queryLanguage": "en"
  },
  {
    "url": "https://rccnoticias.com.do/wp-json/wp/v2/posts",
    "name": "RCC Noticias",
    "hosts": [
      "rccnoticias.com.do"
    ],
    "kind": "wordpress",
    "countrySearch": true,
    "queryLanguage": "es"
  },
  {
    "url": "https://newsinamerica.com/pdcc/wp-json/wp/v2/posts",
    "name": "Periódico Digital Centroamericano y del Caribe",
    "hosts": [
      "newsinamerica.com"
    ],
    "kind": "wordpress",
    "countrySearch": true
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
  const sources = [...(sectionPublisherFeeds[`${country.id}/${feed.key}`] ?? []),
    ...national, ...national.flatMap(source => (source.pages ?? []).map(url => ({ ...source, url }))),
    ...regionalPublisherFeeds.map(source => {
      if (!source.countrySearch) return source;
      const names = {BR:'Brasil',DO:'República Dominicana',MX:'México',PA:'Panamá',PE:'Perú',TT:'Trinidad',GF:'Guayana Francesa'};
      const url = new URL(source.url);
      url.searchParams.set('search', source.queryLanguage === 'en' ? (country.id === 'TT' ? 'Trinidad' : country.name) : names[country.id] ?? country.name);
      return {...source, url: url.href};
    })];
  const seen = new Set();
  return sources.filter(source => !seen.has(source.url) && seen.add(source.url));
}
