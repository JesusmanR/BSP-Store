import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  BSP_OFFICIAL_CONTACT,
  colombiaDepartments,
  getCitiesByDepartment,
  isLocalDeliveryDestination,
} from '@/data/catalog';
import { prisma } from '@/server/db/prisma';
import { SESSION_COOKIE_NAME } from '@/server/http/session';
import { registerCustomer } from '@/server/services/auth.service';
import { createCheckoutOrder } from '@/server/services/order.service';
import { calculateShippingCost } from '@/server/services/shipping.service';
import { POST as createAddressHandler } from '@/app/api/v1/addresses/route';
import {
  PUT as updateAddressHandler,
  DELETE as deleteAddressHandler,
} from '@/app/api/v1/addresses/[addressId]/route';
import {
  GET as getReviewsHandler,
  POST as createReviewHandler,
} from '@/app/api/v1/products/[idOrSlug]/reviews/route';
import { POST as createContactHandler } from '@/app/api/v1/contact/route';

describe('Mejoras de Experiencia Colombia: 32 Departamentos, Domicilio Local vs Nacional, Direcciones y Cumplimiento Legal', () => {
  it('incluye los 32 departamentos de Colombia más Bogotá D. C. (33 territorios) y filtra ciudades por departamento', () => {
    expect(colombiaDepartments.length).toBe(33);
    expect(colombiaDepartments).toContain('Bogotá D. C.');
    expect(colombiaDepartments).toContain('Amazonas');
    expect(colombiaDepartments).toContain('Antioquia');
    expect(colombiaDepartments).toContain('San Andrés y Providencia');
    expect(colombiaDepartments).toContain('Vaupés');
    expect(colombiaDepartments).toContain('Vichada');

    const antioquiaCities = getCitiesByDepartment('Antioquia');
    expect(antioquiaCities).toContain('Medellín');
    expect(antioquiaCities).toContain('Envigado');
    expect(antioquiaCities).not.toContain('Cali');

    const valleCities = getCitiesByDepartment('Valle del Cauca');
    expect(valleCities).toContain('Cali');
    expect(valleCities).toContain('Palmira');
    expect(valleCities).not.toContain('Medellín');
  });

  it('asigna Domicilio Local en Bucaramanga y su Área Metropolitana (Santander) sin transportadoras nacionales y usa empresas nacionales para el resto del país', async () => {
    expect(BSP_OFFICIAL_CONTACT.phoneRaw).toBe('3028000240');
    expect(BSP_OFFICIAL_CONTACT.city).toBe('Bucaramanga');
    expect(BSP_OFFICIAL_CONTACT.email).toBe('compras@bspstore.com.co');
    expect(BSP_OFFICIAL_CONTACT.instagramHandle).toBe('@bspstore.co');
    expect(BSP_OFFICIAL_CONTACT.instagramUrl).toBe('https://www.instagram.com/bspstore.co/');
    expect(BSP_OFFICIAL_CONTACT.facebookHandle).toBe('facebook.com/bspstore.co/');
    expect(BSP_OFFICIAL_CONTACT.facebookUrl).toBe('https://www.facebook.com/bspstore.co/');

    expect(isLocalDeliveryDestination('Santander', 'Bucaramanga')).toBe(true);
    expect(isLocalDeliveryDestination('Santander', 'Floridablanca')).toBe(true);
    expect(isLocalDeliveryDestination('Santander', 'Girón')).toBe(true);
    expect(isLocalDeliveryDestination('Santander', 'Piedecuesta')).toBe(true);
    expect(isLocalDeliveryDestination('Santander', 'Barrancabermeja')).toBe(false);
    expect(isLocalDeliveryDestination('Bogotá D. C.', 'Bogotá D. C.')).toBe(false);
    expect(isLocalDeliveryDestination('Antioquia', 'Medellín')).toBe(false);

    const localQuote = await calculateShippingCost('Santander', 'Bucaramanga', 250000);
    expect(localQuote.isLocalDelivery).toBe(true);
    expect(localQuote.deliveryMethodName).toBe('Domicilio Local');
    expect(localQuote.availableCarriers).toEqual(['Domicilio Local']);
    expect(localQuote.availableCarriers).not.toContain('Servientrega');

    const nationalQuote = await calculateShippingCost('Bogotá D. C.', 'Bogotá D. C.', 250000);
    expect(nationalQuote.isLocalDelivery).toBe(false);
    expect(nationalQuote.deliveryMethodName).toBe('Envío Nacional Asegurado');
    expect(nationalQuote.availableCarriers).toContain('Servientrega');
    expect(nationalQuote.availableCarriers).toContain('Coordinadora');
    expect(nationalQuote.availableCarriers).toContain('Inter Rapidísimo');
    expect(nationalQuote.availableCarriers).toContain('Envía');
  });

  it('asocia automáticamente la modalidad Domicilio Local en pedidos con entrega en Bucaramanga, Santander', async () => {
    const result = await createCheckoutOrder({
      customerName: 'Cliente Domicilio Bucaramanga',
      customerEmail: 'domicilio.bucaramanga@bspstore.com.co',
      customerPhone: '3028000240',
      department: 'Santander',
      city: 'Bucaramanga',
      streetAddress: 'Carrera 33 # 48 - 10 Cabecera del Llano',
      paymentMethod: 'BREB',
      items: [{ productIdOrLegacyId: 1, quantity: 1 }],
    });

    expect(result.order.shipment?.carrier?.code).toBe('DOMICILIO_LOCAL');
    expect(result.order.shipment?.carrier?.name).toBe('Domicilio Local');
  });

  it('exige consentimiento de Términos (Ley 1480) y Datos Personales (Ley 1581) al crear cuenta y audita la aceptación', async () => {
    await expect(
      registerCustomer({
        name: 'Usuario Sin Consentimiento',
        email: `noconsent.${Date.now()}@bspstore.com.co`,
        password: 'Password123',
        acceptTerms: true,
        acceptPrivacyPolicy: false,
      })
    ).rejects.toThrow(/Tratamiento de Datos Personales/i);

    const uniqueEmail = `consent.${Date.now()}@bspstore.com.co`;
    const created = await registerCustomer({
      name: 'Usuario Con Consentimiento Colombia',
      email: uniqueEmail,
      password: 'Password123',
      phone: '3109998877',
      acceptTerms: true,
      acceptPrivacyPolicy: true,
    });

    expect(created.user.email).toBe(uniqueEmail);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'User',
        entityId: created.user.id,
        action: 'AUTH_REGISTER',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(audit).toBeTruthy();
    const meta = audit?.metadata as Record<string, unknown> | null;
    expect(meta?.acceptedTermsLey1480).toBe(true);
    expect(meta?.acceptedPrivacyLey1581).toBe(true);
  });

  it('permite crear, editar y eliminar direcciones guardadas del cliente en /api/v1/addresses/[addressId]', async () => {
    const uniqueEmail = `addr.crud.${Date.now()}@bspstore.com.co`;
    const { sessionToken } = await registerCustomer({
      name: 'Cliente Direcciones CRUD',
      email: uniqueEmail,
      password: 'Password123',
      phone: '3004445566',
      acceptTerms: true,
      acceptPrivacyPolicy: true,
    });

    const createReq = new NextRequest('http://localhost:3000/api/v1/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
      body: JSON.stringify({
        label: 'Casa',
        recipientName: 'Cliente Direcciones CRUD',
        phone: '3004445566',
        department: 'Antioquia',
        city: 'Medellín',
        streetAddress: 'Calle 10 # 43A - 18',
        isDefault: true,
      }),
    });

    const createRes = await createAddressHandler(createReq);
    const createJson = await createRes.json();
    expect(createRes.status).toBe(201);
    const addressId = createJson.data.address.id as string;

    // Editar la dirección guardada
    const updateReq = new NextRequest(`http://localhost:3000/api/v1/addresses/${addressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
      body: JSON.stringify({
        label: 'Oficina Medellín',
        recipientName: 'Cliente Direcciones CRUD',
        phone: '3004445566',
        department: 'Antioquia',
        city: 'Envigado',
        streetAddress: 'Carrera 48 # 25 Sur - 10',
        additionalInfo: 'Torre Empresarial Piso 8',
        isDefault: true,
      }),
    });

    const updateRes = await updateAddressHandler(updateReq, {
      params: Promise.resolve({ addressId }),
    });
    const updateJson = await updateRes.json();
    expect(updateRes.status).toBe(200);
    expect(updateJson.data.address.label).toBe('Oficina Medellín');
    expect(updateJson.data.address.city).toBe('Envigado');

    // Eliminar la dirección guardada
    const deleteReq = new NextRequest(`http://localhost:3000/api/v1/addresses/${addressId}`, {
      method: 'DELETE',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
    });
    const deleteRes = await deleteAddressHandler(deleteReq, {
      params: Promise.resolve({ addressId }),
    });
    const deleteJson = await deleteRes.json();
    expect(deleteRes.status).toBe(200);
    expect(deleteJson.data.deletedId).toBe(addressId);
  });

  it('permite publicar y consultar opiniones verificadas de productos', async () => {
    const uniqueEmail = `reviewer.${Date.now()}@bspstore.com.co`;
    const registered = await registerCustomer({
      name: 'Gamer Bucaramanga',
      email: uniqueEmail,
      password: 'Password123',
      acceptTerms: true,
      acceptPrivacyPolicy: true,
    });

    const postReviewReq = new NextRequest('http://localhost:3000/api/v1/products/1/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${registered.sessionToken}`,
      },
      body: JSON.stringify({
        rating: 5,
        title: 'Sensor impecable y entrega rápida en Bucaramanga',
        comment: 'Excelente mouse inalámbrico, llegó el mismo día con Domicilio Local.',
      }),
    });

    const postRes = await createReviewHandler(postReviewReq, {
      params: Promise.resolve({ idOrSlug: '1' }),
    });
    const postJson = await postRes.json();
    expect(postRes.status).toBe(201);
    expect(postJson.data.review.rating).toBe(5);
    expect(postJson.data.review.authorName).toBe('Gamer Bucaramanga');

    const getReviewReq = new NextRequest('http://localhost:3000/api/v1/products/1/reviews');
    const getRes = await getReviewsHandler(getReviewReq, {
      params: Promise.resolve({ idOrSlug: '1' }),
    });
    const getJson = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getJson.data.totalReviews).toBeGreaterThanOrEqual(1);
    expect(getJson.data.averageRating).toBeGreaterThanOrEqual(4);
  });

  it('registra consultas y solicitudes de asesoría desde el formulario de contacto (/api/v1/contact)', async () => {
    const contactReq = new NextRequest('http://localhost:3000/api/v1/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cliente Setup Santander',
        email: 'setup.santander@bspstore.com.co',
        topic: 'Asesoría de productos',
        message: 'Quiero armar un combo de mouse y teclado inalámbrico en Bucaramanga.',
      }),
    });

    const contactRes = await createContactHandler(contactReq);
    const contactJson = await contactRes.json();
    expect(contactRes.status).toBe(201);
    expect(contactJson.data.inquiry.email).toBe('setup.santander@bspstore.com.co');
    expect(contactJson.data.inquiry.topic).toBe('Asesoría de productos');
  });
});
