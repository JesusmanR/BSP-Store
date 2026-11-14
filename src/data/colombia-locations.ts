export type ColombiaDepartment =
  | 'Santander'
  | 'Amazonas'
  | 'Antioquia'
  | 'Arauca'
  | 'Atlántico'
  | 'Bogotá D. C.'
  | 'Bolívar'
  | 'Boyacá'
  | 'Caldas'
  | 'Caquetá'
  | 'Casanare'
  | 'Cauca'
  | 'Cesar'
  | 'Chocó'
  | 'Córdoba'
  | 'Cundinamarca'
  | 'Guainía'
  | 'Guaviare'
  | 'Huila'
  | 'La Guajira'
  | 'Magdalena'
  | 'Meta'
  | 'Nariño'
  | 'Norte de Santander'
  | 'Putumayo'
  | 'Quindío'
  | 'Risaralda'
  | 'San Andrés y Providencia'
  | 'Sucre'
  | 'Tolima'
  | 'Valle del Cauca'
  | 'Vaupés'
  | 'Vichada';

export const BSP_OFFICIAL_CONTACT = {
  phoneRaw: '3028000240',
  phoneDisplay: '302 800 0240',
  phoneInternational: '+57 302 800 0240',
  whatsappUrl: 'https://wa.me/573028000240',
  email: 'compras@bspstore.com.co',
  city: 'Bucaramanga',
  department: 'Santander',
  locationLabel: 'Bucaramanga, Santander',
  instagramHandle: '@bspstore.co',
  instagramUrl: 'https://www.instagram.com/bspstore.co/',
  facebookHandle: 'facebook.com/bspstore.co/',
  facebookUrl: 'https://www.facebook.com/bspstore.co/',
} as const;

export const COLOMBIA_LOCATIONS: Record<ColombiaDepartment, readonly string[]> = {
  Santander: [
    'Bucaramanga',
    'Floridablanca',
    'Girón',
    'Piedecuesta',
    'Barrancabermeja',
    'San Gil',
    'Socorro',
    'Barbosa',
    'Lebrija',
    'Zapatoca',
  ],
  Amazonas: ['Leticia', 'Puerto Nariño'],
  Antioquia: [
    'Medellín',
    'Apartadó',
    'Bello',
    'Caldas',
    'Carmen de Viboral',
    'Caucasia',
    'Copacabana',
    'Envigado',
    'Girardota',
    'Guarne',
    'Itagüí',
    'La Ceja',
    'La Estrella',
    'Marinilla',
    'Rionegro',
    'Sabaneta',
    'Santa Fe de Antioquia',
    'Turbo',
  ],
  Arauca: ['Arauca', 'Arauquita', 'Fortul', 'Saravena', 'Tame'],
  Atlántico: [
    'Barranquilla',
    'Baranoa',
    'Galapa',
    'Malambo',
    'Puerto Colombia',
    'Sabanalarga',
    'Santo Tomás',
    'Soledad',
  ],
  'Bogotá D. C.': ['Bogotá D. C.'],
  Bolívar: [
    'Cartagena de Indias',
    'Arjona',
    'El Carmen de Bolívar',
    'Magangué',
    'Mompós',
    'Santa Rosa del Sur',
    'Turbaco',
  ],
  Boyacá: [
    'Tunja',
    'Chiquinquirá',
    'Duitama',
    'Garagoa',
    'Moniquirá',
    'Paipa',
    'Puerto Boyacá',
    'Samacá',
    'Sogamoso',
    'Villa de Leyva',
  ],
  Caldas: [
    'Manizales',
    'Anserma',
    'Chinchiná',
    'La Dorada',
    'Riosucio',
    'Salamina',
    'Villamaría',
  ],
  Caquetá: [
    'Florencia',
    'Belén de los Andaquíes',
    'El Doncello',
    'Puerto Rico',
    'San Vicente del Caguán',
  ],
  Casanare: [
    'Yopal',
    'Aguazul',
    'Monterrey',
    'Paz de Ariporo',
    'Tauramena',
    'Villanueva',
  ],
  Cauca: [
    'Popayán',
    'Guapi',
    'Miranda',
    'Patía',
    'Piendamó',
    'Puerto Tejada',
    'Santander de Quilichao',
    'Silvia',
  ],
  Cesar: [
    'Valledupar',
    'Aguachica',
    'Agustín Codazzi',
    'Bosconia',
    'Curumaní',
    'El Copey',
    'La Jagua de Ibirico',
  ],
  Chocó: ['Quibdó', 'Acandí', 'Bahía Solano', 'Condoto', 'Istmina', 'Nuquí', 'Tadó'],
  Córdoba: [
    'Montería',
    'Cereté',
    'Ciénaga de Oro',
    'Lorica',
    'Montelíbano',
    'Planeta Rica',
    'Sahagún',
    'San Antero',
    'Tierralta',
  ],
  Cundinamarca: [
    'Chía',
    'Cajicá',
    'Cota',
    'Facatativá',
    'Funza',
    'Fusagasugá',
    'Girardot',
    'La Calera',
    'Madrid',
    'Mosquera',
    'Pacho',
    'Soacha',
    'Sopó',
    'Tabio',
    'Tenjo',
    'Tocancipá',
    'Ubaté',
    'Villeta',
    'Zipaquirá',
  ],
  Guainía: ['Inírida', 'Barrancominas'],
  Guaviare: ['San José del Guaviare', 'Calamar', 'El Retorno', 'Miraflores'],
  Huila: [
    'Neiva',
    'Campoalegre',
    'Garzón',
    'La Plata',
    'Palermo',
    'Pitalito',
    'Rivera',
    'San Agustín',
  ],
  'La Guajira': [
    'Riohacha',
    'Barrancas',
    'Fonseca',
    'Maicao',
    'Manaure',
    'San Juan del Cesar',
    'Uribia',
    'Villanueva',
  ],
  Magdalena: [
    'Santa Marta',
    'Aracataca',
    'Ciénaga',
    'El Banco',
    'Fundación',
    'Plato',
    'Zona Bananera',
  ],
  Meta: [
    'Villavicencio',
    'Acacías',
    'Cumaral',
    'Granada',
    'Puerto Gaitán',
    'Puerto López',
    'Restrepo',
    'San Martín',
  ],
  Nariño: ['Pasto', 'Ipiales', 'La Unión', 'Samaniego', 'Sandoná', 'Tumaco', 'Túquerres'],
  'Norte de Santander': [
    'Cúcuta',
    'Chinácota',
    'El Zulia',
    'Los Patios',
    'Ocaña',
    'Pamplona',
    'Tibú',
    'Villa del Rosario',
  ],
  Putumayo: [
    'Mocoa',
    'Orito',
    'Puerto Asís',
    'Sibundoy',
    'Valle del Guamuez',
    'Villagarzón',
  ],
  Quindío: [
    'Armenia',
    'Calarcá',
    'Circasia',
    'Filandia',
    'La Tebaida',
    'Montenegro',
    'Quimbaya',
    'Salento',
  ],
  Risaralda: [
    'Pereira',
    'Belén de Umbría',
    'Dosquebradas',
    'La Virginia',
    'Marsella',
    'Santa Rosa de Cabal',
  ],
  'San Andrés y Providencia': ['San Andrés', 'Providencia y Santa Catalina'],
  Sucre: ['Sincelejo', 'Corozal', 'Coveñas', 'Sampués', 'San Marcos', 'Sincé', 'Tolú'],
  Tolima: [
    'Ibagué',
    'Chaparral',
    'Espinal',
    'Flandes',
    'Guamo',
    'Honda',
    'Líbano',
    'Mariquita',
    'Melgar',
  ],
  'Valle del Cauca': [
    'Cali',
    'Buenaventura',
    'Buga',
    'Candelaria',
    'Cartago',
    'Florida',
    'Jamundí',
    'Palmira',
    'Pradera',
    'Sevilla',
    'Tuluá',
    'Yumbo',
    'Zarzal',
  ],
  Vaupés: ['Mitú', 'Carurú', 'Taraira'],
  Vichada: ['Puerto Carreño', 'Cumaribo', 'La Primavera', 'Santa Rosalía'],
};

export const COLOMBIA_DEPARTMENTS = Object.keys(COLOMBIA_LOCATIONS) as ColombiaDepartment[];

export function getCitiesByDepartment(department: string): readonly string[] {
  const normalized = department.trim();
  if (!normalized) return [];
  if (normalized in COLOMBIA_LOCATIONS) {
    return COLOMBIA_LOCATIONS[normalized as ColombiaDepartment];
  }
  const foundKey = COLOMBIA_DEPARTMENTS.find(
    (dept) => dept.toLowerCase() === normalized.toLowerCase()
  );
  return foundKey ? COLOMBIA_LOCATIONS[foundKey] : [];
}

/**
 * Ciudades con cobertura de Domicilio Local desde nuestra sede principal en Bucaramanga, Santander
 * (Bucaramanga y su Área Metropolitana: Floridablanca, Girón y Piedecuesta).
 */
const BUCARAMANGA_LOCAL_DELIVERY_CITIES = new Set([
  'bucaramanga',
  'floridablanca',
  'girón',
  'giron',
  'piedecuesta',
]);

/**
 * Determina si el destino corresponde a entrega a Domicilio Local (Bucaramanga y Área Metropolitana en Santander)
 * en lugar de despacho por empresas transportadoras nacionales.
 */
export function isLocalDeliveryDestination(department?: string, city?: string): boolean {
  const normDept = (department ?? '').trim().toLowerCase();
  const normCity = (city ?? '').trim().toLowerCase();

  if (normCity && BUCARAMANGA_LOCAL_DELIVERY_CITIES.has(normCity)) {
    return true;
  }

  // Si solo se especificó el departamento Santander sin ciudad distinta, o la ciudad es Santander por defecto
  if (normDept === 'santander' && (!normCity || normCity === 'santander' || normCity === 'general')) {
    return true;
  }

  return false;
}

export const NATIONAL_CARRIERS = [
  'Servientrega',
  'Coordinadora',
  'Inter Rapidísimo',
  'Envía',
] as const;
