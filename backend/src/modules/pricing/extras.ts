import { toPesewas } from '../../common/money';

/**
 * Extras are a catalog, not client input: the client sends a code, the server
 * resolves the price. Anything the client says about money is ignored.
 */
export const CHAUFFEUR_EXTRAS = {
  meet_greet: {
    label: 'Meet and greet with name board',
    pricePesewas: toPesewas(30),
  },
  child_seat: {
    label: 'Child seat',
    pricePesewas: toPesewas(25),
  },
  extra_stop: {
    label: 'One extra stop',
    pricePesewas: toPesewas(40),
  },
  refreshments: {
    label: 'Hot or cold towel and snacks',
    pricePesewas: toPesewas(20),
  },
} as const;

export type ChauffeurExtraCode = keyof typeof CHAUFFEUR_EXTRAS;

export const CHAUFFEUR_EXTRA_CODES = Object.keys(CHAUFFEUR_EXTRAS) as ChauffeurExtraCode[];
