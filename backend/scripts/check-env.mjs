import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const uri = process.env.MONGODB_URI || '';
const host = (uri.match(/@([^/?]+)/) || [])[1] || '(none)';
const tail = uri.includes('.net') ? uri.split('.net')[1] : '(none)';

console.log('  URI set          :', Boolean(uri));
console.log('  scheme           :', uri.split('://')[0]);
console.log('  host             :', host);
console.log('  db path + opts   :', tail);
console.log('  quotes stripped  :', !uri.startsWith('"') && !uri.startsWith("'"));
console.log('  still local      :', uri.includes('127.0.0.1') || uri.startsWith('mongodb://'));
console.log('  ends as expected  :', uri.endsWith('/aust-pic?retryWrites=true&w=majority'));
