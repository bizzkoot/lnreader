import { TaxonomyNode } from './utils';

export const GENRE_TAXONOMY: TaxonomyNode[] = [
  {
    name: 'Fantasy',
    children: ['High Fantasy', 'Urban Fantasy', 'Portal Fantasy'],
  },
  {
    name: 'Action',
    children: ['Adventure', 'Martial Arts', 'Wuxia', 'Xianxia'],
  },
  { name: 'Romance', children: ['Harem', 'Slice of Life', 'Drama', 'Shoujo'] },
  { name: 'Sci-Fi', children: ['Mecha', 'Space', 'Time Travel'] },
  { name: 'Mystery', children: ['Thriller', 'Horror', 'Supernatural'] },
  { name: 'Comedy', children: ['Parody', 'Satire'] },
  { name: 'Isekai', children: ['Reincarnation', 'Transmigration'] },
];
