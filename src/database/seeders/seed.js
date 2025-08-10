console.log('--- Seeder script started ---'.bold.magenta);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const colors = require('colors');
const config = require('../../config/config');

// 1. Load env vars
dotenv.config({ path: './src/config/config.env' });
console.log('Database URI:'.grey, config.db.uri ? 'Loaded' : 'NOT LOADED');

// 2. Register all models
require('../../models/user.model');
require('../../models/admin.model');
require('../../models/pressing.model');
require('../../models/order.model');
require('../../models/payment.model');

const User = mongoose.model('User');
const Admin = mongoose.model('Admin');
const Pressing = mongoose.model('Pressing');
const Order = mongoose.model('Order');
const Payment = mongoose.model('Payment');

const main = async () => {
  try {
    await mongoose.connect(config.db.uri, {});
    console.log(`MongoDB Connected for Seeder`.cyan.underline.bold);

    if (process.argv[2] === '-d') {
      await destroyData();
    } else {
      await importData();
    }
  } catch (err) {
    console.error(`DB Connection or Seeder Error: ${err.message}`.red.bold);
    process.exit(1);
  }
};

main();

// --- Data Definitions ---
const admins = [
  { fullName: 'Super Admin', email: 'superadmin@geopressci.com', password: 'password123', isSuperAdmin: true, permissions: ['manage_all'] },
  { fullName: 'Admin Standard', email: 'admin@geopressci.com', password: 'password123', permissions: ['manage_pressings', 'manage_users'] }
];

const users = [
  { fullName: 'Jean Client', email: 'client1@geopressci.com', password: 'password123', role: 'client', phone: '0707070701' },
  { fullName: 'Awa Cliente', email: 'client2@geopressci.com', password: 'password123', role: 'client', phone: '0707070702' },
  { fullName: 'Proprio Pressing Approuvé', email: 'owner.approved@geopressci.com', password: 'password123', role: 'pressing', phone: '0505050501' },
  { fullName: 'Proprio Pressing En Attente', email: 'owner.pending@geopressci.com', password: 'password123', role: 'pressing', phone: '0505050502' },
  { fullName: 'Proprio Pressing Rejeté', email: 'owner.rejected@geopressci.com', password: 'password123', role: 'pressing', phone: '0505050503' },
];

const importData = async () => {
  try {
    console.log('1. Deleting existing data...'.yellow);
    await Promise.all([Order.deleteMany(), Payment.deleteMany(), Pressing.deleteMany(), User.deleteMany(), Admin.deleteMany()]);
    console.log('   -> All previous data deleted.'.green);

    console.log('2. Creating new data...'.yellow);
    await Admin.insertMany(admins);
    console.log('   -> Admins created.'.gray);

    const createdUsers = await User.insertMany(users);
    console.log('   -> Users created.'.gray);

    const ownerMap = createdUsers.reduce((map, user) => {
      if (user.role === 'pressing') map[user.email] = user._id;
      return map;
    }, {});

    const pressingsToCreate = [
      { businessName: 'Pressing Éclat (Approuvé)', owner: ownerMap['owner.approved@geopressci.com'], status: 'approved', approvedAt: new Date(), address: { street: 'Rue des Jardins', city: 'Cocody' } },
      { businessName: 'Net Pressing (En attente)', owner: ownerMap['owner.pending@geopressci.com'], status: 'pending_approval', address: { street: 'Boulevard VGE', city: 'Marcory' } },
      { businessName: 'Lavage Express (Rejeté)', owner: ownerMap['owner.rejected@geopressci.com'], status: 'rejected', rejectionReason: 'Documents non conformes.', address: { street: 'Rue du Commerce', city: 'Plateau' } },
    ];
    const createdPressings = await Pressing.insertMany(pressingsToCreate);
    console.log('   -> Pressings created.'.gray);

    const client1 = createdUsers.find(u => u.email === 'client1@geopressci.com');
    const pressing1 = createdPressings[0];

    const order = await Order.create({
      customer: client1._id,
      pressing: pressing1._id,
      items: [{ serviceDetails: { name: 'Chemise', price: 1000 }, quantity: 5, unitPrice: 1000 }],
      payment: { amount: { total: 5000 }, method: 'mobile_money' },
      status: 'completed'
    });
    console.log('   -> Order created.'.gray);

    await Payment.create({ commande: order._id, client: client1._id, amount: 5000, paymentMethod: 'orangemoney', status: 'succeeded', transactionId: 'pi_test_12345' });
    console.log('   -> Payment created.'.gray);

    console.log('\nDATA IMPORTED SUCCESSFULLY!'.bgGreen.black);
    mongoose.connection.close();

  } catch (err) {
    console.error(`\nERROR DURING DATA IMPORT: ${err.message}`.red.bold);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    console.log('Deleting all data...'.yellow);
    await Promise.all([Order.deleteMany(), Payment.deleteMany(), Pressing.deleteMany(), User.deleteMany(), Admin.deleteMany()]);
    console.log('\nDATA DESTROYED!'.bgRed.black);
    mongoose.connection.close();
  } catch (err) {
    console.error(`\nERROR DURING DATA DESTRUCTION: ${err.message}`.red.bold);
    process.exit(1);
  }
};

