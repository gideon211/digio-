import { toPesewas } from '../../common/money';

/**
 * Rental extras are priced per day, unlike transfer extras which are flat.
 * The service multiplies by the number of days so the engine still receives a
 * flat amount and stays a pure function of its inputs.
 */
export const RENTAL_EXTRAS = {
  child_seat: {
    label: 'Child seat',
    dailyPesewas: toPesewas(25),
  },
  additional_driver: {
    label: 'Additional driver',
    dailyPesewas: toPesewas(60),
  },
  wifi: {
    label: 'Mobile Wi-Fi',
    dailyPesewas: toPesewas(35),
  },
} as const;

export type RentalExtraCode = keyof typeof RENTAL_EXTRAS;

export const RENTAL_EXTRA_CODES = Object.keys(RENTAL_EXTRAS) as RentalExtraCode[];

/** Flat delivery and collection inside Accra. */
export const DELIVERY_FEE_PESEWAS = toPesewas(60);
