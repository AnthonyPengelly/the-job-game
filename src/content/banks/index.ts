import categoriesJson from '../../../presets/default/content/banks/categories.json';
import { categoriesBankSchema } from '@/content/schema/bank';

/** Categories content bank — parsed and validated at module load. Fails loudly on malformed data. */
export const categoriesBank = categoriesBankSchema.parse(categoriesJson);
