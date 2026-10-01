const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const { pool, testConnection } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

// Serve frontend from backend/frontend
app.use(express.static(path.join(__dirname, 'frontend')));

function normalizeMedicineRow(medicine) {
  const currentStock = Number(medicine.current_stock || 0);
  const minimumStock = Number(medicine.minimum_stock || 0);
  const maximumStock = Number(medicine.maximum_stock || 0);
  const unitPrice = Number(medicine.unit_price || 0);
  const percent =
    maximumStock > 0 ? (currentStock / maximumStock) * 100 : 0;

  let status = 'FULL';

  if (currentStock <= minimumStock) {
    status = 'LOW';
  } else if (percent < 80) {
    status = 'MEDIUM';
  }

  return {
    ...medicine,
    current_stock: currentStock,
    minimum_stock: minimumStock,
    maximum_stock: maximumStock,
    unit_price: unitPrice,
    stock_percentage: Number(percent.toFixed(2)),
    status
  };
}

function validateNumber(value, fieldName, options = {}) {
  const { min = 0, allowZero = false } = options;
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw Object.assign(
      new Error(`${fieldName} must be a valid number`),
      { statusCode: 400 }
    );
  }

  if (allowZero ? numberValue < min : numberValue <= min) {
    throw Object.assign(
      new Error(`${fieldName} must be greater than ${min}`),
      { statusCode: 400 }
    );
  }

  return numberValue;
}

function isMissing(value) {
  return (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  );
}

async function fetchSuppliers() {
  const [suppliers] = await pool.query(
    'SELECT * FROM suppliers ORDER BY name ASC'
  );

  return suppliers;
}

async function fetchMedicines() {
  const [medicines] = await pool.query(
    `SELECT m.*, s.name AS supplier_name
     FROM medicines m
     LEFT JOIN suppliers s ON s.id = m.supplier_id
     ORDER BY m.created_at DESC`
  );

  return medicines.map((item) => normalizeMedicineRow(item));
}

/* =========================
   HEALTH
========================= */

app.get('/api/health', async (req, res) => {
  const connected = await testConnection();

  res.json({
    status: connected ? 'ok' : 'database-unavailable',
    message: connected
      ? 'Backend connected to MySQL.'
      : 'Backend running but MySQL connection is not available.'
  });
});

/* =========================
   MEDICINES
========================= */

app.get('/api/medicines', async (req, res, next) => {
  try {
    const medicines = await fetchMedicines();
    res.json({ medicines });
  } catch (error) {
    next(error);
  }
});

app.get('/api/medicines/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.*, s.name AS supplier_name
       FROM medicines m
       LEFT JOIN suppliers s ON s.id = m.supplier_id
       WHERE m.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: 'Medicine not found'
      });
    }

    return res.json({
      medicine: normalizeMedicineRow(rows[0])
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/medicines', async (req, res, next) => {
  try {
    const body = req.body || {};

    const required = [
      'name',
      'category',
      'current_stock',
      'minimum_stock',
      'maximum_stock',
      'unit_price',
      'supplier_id',
      'rack_location',
      'expiry_date'
    ];

    for (const field of required) {
      if (isMissing(body[field])) {
        throw Object.assign(
          new Error(`Missing required field: ${field}`),
          { statusCode: 400 }
        );
      }
    }

    const supplierId = Number(body.supplier_id);

    validateNumber(supplierId, 'supplier_id', {
      min: 0,
      allowZero: false
    });

    validateNumber(body.current_stock, 'current_stock', {
      min: 0,
      allowZero: true
    });

    validateNumber(body.minimum_stock, 'minimum_stock', {
      min: 0,
      allowZero: true
    });

    validateNumber(body.maximum_stock, 'maximum_stock', {
      min: 0,
      allowZero: false
    });

    validateNumber(body.unit_price, 'unit_price', {
      min: 0,
      allowZero: true
    });

    const [supplierRows] = await pool.query(
      'SELECT id FROM suppliers WHERE id = ?',
      [supplierId]
    );

    if (!supplierRows.length) {
      throw Object.assign(
        new Error('Invalid supplier ID'),
        { statusCode: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO medicines
        (
          name,
          category,
          current_stock,
          minimum_stock,
          maximum_stock,
          unit_price,
          supplier_id,
          rack_location,
          expiry_date,
          description,
          created_at,
          updated_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        body.name.trim(),
        body.category.trim(),
        Number(body.current_stock),
        Number(body.minimum_stock),
        Number(body.maximum_stock),
        Number(body.unit_price),
        supplierId,
        body.rack_location.trim(),
        body.expiry_date,
        body.description ? body.description.trim() : ''
      ]
    );

    const [rows] = await pool.query(
      `SELECT m.*, s.name AS supplier_name
       FROM medicines m
       LEFT JOIN suppliers s ON s.id = m.supplier_id
       WHERE m.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      message: 'Medicine added successfully',
      medicine: normalizeMedicineRow(rows[0])
    });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/medicines/:id', async (req, res, next) => {
  try {
    const body = req.body || {};
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw Object.assign(
        new Error('Invalid medicine ID'),
        { statusCode: 400 }
      );
    }

    const [existingRows] = await pool.query(
      'SELECT * FROM medicines WHERE id = ?',
      [id]
    );

    if (!existingRows.length) {
      throw Object.assign(
        new Error('Medicine not found'),
        { statusCode: 404 }
      );
    }

    const currentRecord = existingRows[0];

    const payload = {
      name: body.name ?? currentRecord.name,
      category: body.category ?? currentRecord.category,
      current_stock:
        body.current_stock ?? currentRecord.current_stock,
      minimum_stock:
        body.minimum_stock ?? currentRecord.minimum_stock,
      maximum_stock:
        body.maximum_stock ?? currentRecord.maximum_stock,
      unit_price:
        body.unit_price ?? currentRecord.unit_price,
      supplier_id:
        body.supplier_id ?? currentRecord.supplier_id,
      rack_location:
        body.rack_location ?? currentRecord.rack_location,
      expiry_date:
        body.expiry_date ?? currentRecord.expiry_date,
      description:
        body.description ?? currentRecord.description
    };

    validateNumber(payload.current_stock, 'current_stock', {
      min: 0,
      allowZero: true
    });

    validateNumber(payload.minimum_stock, 'minimum_stock', {
      min: 0,
      allowZero: true
    });

    validateNumber(payload.maximum_stock, 'maximum_stock', {
      min: 0,
      allowZero: false
    });

    validateNumber(payload.unit_price, 'unit_price', {
      min: 0,
      allowZero: true
    });

    validateNumber(payload.supplier_id, 'supplier_id', {
      min: 0,
      allowZero: false
    });

    if (payload.supplier_id) {
      const [supplierRows] = await pool.query(
        'SELECT id FROM suppliers WHERE id = ?',
        [payload.supplier_id]
      );

      if (!supplierRows.length) {
        throw Object.assign(
          new Error('Invalid supplier ID'),
          { statusCode: 400 }
        );
      }
    }

    await pool.query(
      `UPDATE medicines
       SET
         name = ?,
         category = ?,
         current_stock = ?,
         minimum_stock = ?,
         maximum_stock = ?,
         unit_price = ?,
         supplier_id = ?,
         rack_location = ?,
         expiry_date = ?,
         description = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        String(payload.name).trim(),
        String(payload.category).trim(),
        Number(payload.current_stock),
        Number(payload.minimum_stock),
        Number(payload.maximum_stock),
        Number(payload.unit_price),
        Number(payload.supplier_id),
        String(payload.rack_location).trim(),
        payload.expiry_date,
        payload.description
          ? String(payload.description).trim()
          : '',
        id
      ]
    );

    const [rows] = await pool.query(
      `SELECT m.*, s.name AS supplier_name
       FROM medicines m
       LEFT JOIN suppliers s ON s.id = m.supplier_id
       WHERE m.id = ?`,
      [id]
    );

    return res.json({
      message: 'Medicine updated successfully',
      medicine: normalizeMedicineRow(rows[0])
    });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/medicines/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw Object.assign(
        new Error('Invalid medicine ID'),
        { statusCode: 400 }
      );
    }

    const [result] = await pool.query(
      'DELETE FROM medicines WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw Object.assign(
        new Error('Medicine not found'),
        { statusCode: 404 }
      );
    }

    return res.json({
      message: 'Medicine deleted successfully'
    });
  } catch (error) {
    return next(error);
  }
});

/* =========================
   SUPPLIERS
========================= */

app.get('/api/suppliers', async (req, res, next) => {
  try {
    const suppliers = await fetchSuppliers();
    res.json({ suppliers });
  } catch (error) {
    next(error);
  }
});

app.get('/api/suppliers/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: 'Supplier not found'
      });
    }

    return res.json({
      supplier: rows[0]
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/suppliers', async (req, res, next) => {
  try {
    const body = req.body || {};

    const required = [
      'name',
      'contact_person',
      'phone',
      'email',
      'address'
    ];

    for (const field of required) {
      if (isMissing(body[field])) {
        throw Object.assign(
          new Error(`Missing required field: ${field}`),
          { statusCode: 400 }
        );
      }
    }

    const [duplicateRows] = await pool.query(
      'SELECT id FROM suppliers WHERE email = ?',
      [String(body.email).trim()]
    );

    if (duplicateRows.length) {
      throw Object.assign(
        new Error('Supplier with this email already exists'),
        { statusCode: 409 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO suppliers
        (name, contact_person, phone, email, address, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        String(body.name).trim(),
        String(body.contact_person).trim(),
        String(body.phone).trim(),
        String(body.email).trim(),
        String(body.address).trim()
      ]
    );

    const [rows] = await pool.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      message: 'Supplier added successfully',
      supplier: rows[0]
    });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/suppliers/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw Object.assign(
        new Error('Invalid supplier ID'),
        { statusCode: 400 }
      );
    }

    const body = req.body || {};

    const [existingRows] = await pool.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [id]
    );

    if (!existingRows.length) {
      throw Object.assign(
        new Error('Supplier not found'),
        { statusCode: 404 }
      );
    }

    const payload = {
      name: body.name ?? existingRows[0].name,
      contact_person:
        body.contact_person ?? existingRows[0].contact_person,
      phone: body.phone ?? existingRows[0].phone,
      email: body.email ?? existingRows[0].email,
      address: body.address ?? existingRows[0].address
    };

    if (
      String(payload.email).trim() !==
      String(existingRows[0].email).trim()
    ) {
      const [duplicateRows] = await pool.query(
        'SELECT id FROM suppliers WHERE email = ? AND id != ?',
        [String(payload.email).trim(), id]
      );

      if (duplicateRows.length) {
        throw Object.assign(
          new Error('Supplier with this email already exists'),
          { statusCode: 409 }
        );
      }
    }

    await pool.query(
      `UPDATE suppliers
       SET
         name = ?,
         contact_person = ?,
         phone = ?,
         email = ?,
         address = ?
       WHERE id = ?`,
      [
        String(payload.name).trim(),
        String(payload.contact_person).trim(),
        String(payload.phone).trim(),
        String(payload.email).trim(),
        String(payload.address).trim(),
        id
      ]
    );

    const [rows] = await pool.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [id]
    );

    return res.json({
      message: 'Supplier updated successfully',
      supplier: rows[0]
    });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/suppliers/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw Object.assign(
        new Error('Invalid supplier ID'),
        { statusCode: 400 }
      );
    }

    const [result] = await pool.query(
      'DELETE FROM suppliers WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw Object.assign(
        new Error('Supplier not found'),
        { statusCode: 404 }
      );
    }

    return res.json({
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    return next(error);
  }
});

/* =========================
   RESTOCKS
========================= */

app.get('/api/restocks', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.*,
         m.name AS medicine_name,
         s.name AS supplier_name
       FROM restocks r
       LEFT JOIN medicines m ON m.id = r.medicine_id
       LEFT JOIN suppliers s ON s.id = r.supplier_id
       ORDER BY r.restock_date DESC, r.created_at DESC`
    );

    res.json({ restocks: rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/restocks', async (req, res, next) => {
  try {
    const body = req.body || {};

    const required = [
      'medicine_id',
      'supplier_id',
      'quantity',
      'unit_cost',
      'restock_date'
    ];

    for (const field of required) {
      if (isMissing(body[field])) {
        throw Object.assign(
          new Error(`Missing required field: ${field}`),
          { statusCode: 400 }
        );
      }
    }

    const medicineId = Number(body.medicine_id);
    const supplierId = Number(body.supplier_id);
    const quantity = Number(body.quantity);
    const unitCost = Number(body.unit_cost);

    if (!Number.isInteger(medicineId) || medicineId <= 0) {
      throw Object.assign(
        new Error('Invalid medicine ID'),
        { statusCode: 400 }
      );
    }

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      throw Object.assign(
        new Error('Invalid supplier ID'),
        { statusCode: 400 }
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(
        new Error('Quantity must be greater than 0'),
        { statusCode: 400 }
      );
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw Object.assign(
        new Error('Unit cost must be a valid non-negative number'),
        { statusCode: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [medicineRows] = await connection.query(
        'SELECT * FROM medicines WHERE id = ?',
        [medicineId]
      );

      if (!medicineRows.length) {
        throw Object.assign(
          new Error('Invalid medicine ID'),
          { statusCode: 400 }
        );
      }

      const [supplierRows] = await connection.query(
        'SELECT id FROM suppliers WHERE id = ?',
        [supplierId]
      );

      if (!supplierRows.length) {
        throw Object.assign(
          new Error('Invalid supplier ID'),
          { statusCode: 400 }
        );
      }

      const totalCost = quantity * unitCost;

      const [restockResult] = await connection.query(
        `INSERT INTO restocks
          (
            medicine_id,
            supplier_id,
            quantity,
            unit_cost,
            total_cost,
            restock_date,
            remarks,
            created_at
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          medicineId,
          supplierId,
          quantity,
          unitCost,
          totalCost,
          body.restock_date,
          body.remarks || ''
        ]
      );

      await connection.query(
        `UPDATE medicines
         SET
           current_stock = current_stock + ?,
           updated_at = NOW()
         WHERE id = ?`,
        [quantity, medicineId]
      );

      const [updatedMedicine] = await connection.query(
        'SELECT * FROM medicines WHERE id = ?',
        [medicineId]
      );

      await connection.commit();

      return res.status(201).json({
        message: 'Restock created successfully',
        restock: {
          id: restockResult.insertId,
          medicine_id: medicineId,
          supplier_id: supplierId,
          quantity,
          unit_cost: unitCost,
          total_cost: totalCost,
          restock_date: body.restock_date,
          remarks: body.remarks || ''
        },
        medicine: normalizeMedicineRow(updatedMedicine[0])
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

/* =========================
   DASHBOARD
========================= */

app.get('/api/dashboard', async (req, res, next) => {
  try {
    const [summaryRows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM medicines) AS total_medicines,
        (SELECT COUNT(*)
         FROM medicines
         WHERE current_stock <= minimum_stock) AS low_stock,
        (SELECT COUNT(*) FROM suppliers) AS total_suppliers,
        (SELECT COALESCE(
          SUM(current_stock * unit_price), 0
        )
        FROM medicines) AS total_stock_value
    `);

    const summary = summaryRows[0] || {};
    const medicines = await fetchMedicines();

    const [restockRows] = await pool.query(
      `SELECT
         r.*,
         m.name AS medicine_name,
         s.name AS supplier_name
       FROM restocks r
       LEFT JOIN medicines m ON m.id = r.medicine_id
       LEFT JOIN suppliers s ON s.id = r.supplier_id
       ORDER BY r.restock_date DESC, r.created_at DESC
       LIMIT 10`
    );

    return res.json({
      summary: {
        total_medicines:
          Number(summary.total_medicines || 0),
        low_stock:
          Number(summary.low_stock || 0),
        total_suppliers:
          Number(summary.total_suppliers || 0),
        total_stock_value:
          Number(summary.total_stock_value || 0)
      },
      medicines,
      lowStockAlerts: medicines.filter(
        (item) => item.status === 'LOW'
      ),
      recentRestocks: restockRows,
      totalStockValue:
        Number(summary.total_stock_value || 0)
    });
  } catch (error) {
    return next(error);
  }
});

/* =========================
   USERS
========================= */

app.post('/api/users', async (req, res, next) => {
  try {
    const body = req.body || {};

    const required = [
      'name',
      'email',
      'password'
    ];

    for (const field of required) {
      if (isMissing(body[field])) {
        throw Object.assign(
          new Error(`Missing required field: ${field}`),
          { statusCode: 400 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(
      String(body.password),
      10
    );

    const [result] = await pool.query(
      `INSERT INTO users
        (name, email, password, created_at)
       VALUES (?, ?, ?, NOW())`,
      [
        String(body.name).trim(),
        String(body.email).trim(),
        passwordHash
      ]
    );

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.insertId,
        name: body.name,
        email: body.email
      }
    });
  } catch (error) {
    return next(error);
  }
});

/* =========================
   FRONTEND FALLBACK
========================= */

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'frontend', 'index.html')
  );
});

/* =========================
   ERROR HANDLER
========================= */

app.use((error, req, res, next) => {
  console.error(error);

  const databaseUnavailable = [
    'ECONNREFUSED',
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR'
  ].includes(error.code);

  const statusCode =
    error.statusCode ||
    (databaseUnavailable ? 503 : 500);

  res.status(statusCode).json({
    message: databaseUnavailable
      ? 'MySQL is unavailable. Start MySQL, configure backend/.env, and import backend/setup.sql.'
      : error.message || 'Internal server error'
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, async () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );

  try {
    const isConnected = await testConnection();

    if (isConnected) {
      console.log(
        'MySQL connection successful.'
      );
    } else {
      console.log(
        'Server started but MySQL is not reachable.'
      );
    }
  } catch (error) {
    console.log(
      'Server started but database status check failed.'
    );
  }
});