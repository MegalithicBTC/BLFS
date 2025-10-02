// Thank-you page extension: show "Complete payment" for manual payments and deep-link to your app.
import {
  reactExtension,
  Button,
  BlockStack,
  Text,
  useApi,
  useSelectedPaymentOptions,
} from '@shopify/ui-extensions-react/checkout';
import {useEffect, useState} from 'react';

function toTitleish(s) {
  const clean = String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return clean.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}
function summarizeLineItems(items) {
  const arr = Array.isArray(items) ? items : [];
  const parts = arr.map((x) => {
    const qty = Number(x?.quantity || 0);
    const title = toTitleish(x?.title || x?.name || '');
    const variant = toTitleish(x?.variantTitle || x?.variant_title || '');
    const name = variant ? `${title} (${variant})` : title;
    return `${qty}× ${name}`.trim();
  }).filter(Boolean);
  const head = parts.slice(0, 3).join(', ');
  return parts.length > 3 ? `${head}, +${parts.length - 3} more` : head;
}

export default reactExtension('purchase.thank-you.block.render', () => <Extension />);

function Extension() {
  const api = useApi();
  const options = useSelectedPaymentOptions();
  const [paymentUrl, setPaymentUrl] = useState('');

  const hasManualPayment = options.some((o) => String(o?.type || '').toLowerCase() === 'manualpayment');

  useEffect(() => {
    if (!hasManualPayment) return;

    const sub = api.orderConfirmation?.subscribe((oc) => {
      const domain = '__APP_DOMAIN__';
      const shopPublicId = '__PUBLIC_ID__';

      // Get amount from api.cost - these are reactive signals with .current property
      const totalAmount = api.cost?.totalAmount?.current;
      const subtotalAmount = api.cost?.subtotalAmount?.current;
      
      // Amount is a number, not a string
      const amount = totalAmount?.amount ?? subtotalAmount?.amount ?? 0;
      const currency = totalAmount?.currencyCode ?? subtotalAmount?.currencyCode ?? 'USD';

      console.log('=== ORDER CONFIRMATION DATA ===');
      console.log('Amount:', amount, 'Currency:', currency);
      console.log('Order ID:', oc?.order?.id);

      const orderId = oc?.order?.id || '';
      const orderName = oc?.order?.number || oc?.order?.name || '';

      console.log('Order details:', { orderId, orderName, amount, currency });

      const shopDomain = api.shop?.myshopifyDomain || '';
      
      // Get checkout token for server-side order lookup
      const checkoutToken = api.checkoutToken?.current || '';

      const li = oc?.order?.lineItems || oc?.lineItems || [];
      const desc = summarizeLineItems(li);

      const url = new URL(`https://${domain}/pay/${shopPublicId}`);
      url.searchParams.set('amount', amount.toFixed(2));
      url.searchParams.set('currency', String(currency));
      url.searchParams.set('orderGid', String(orderId));
      url.searchParams.set('orderName', String(orderName));
      url.searchParams.set('shopDomain', shopDomain);
      if (checkoutToken) url.searchParams.set('checkoutToken', checkoutToken);
      if (desc) url.searchParams.set('desc', desc);

      setPaymentUrl(url.toString());
    });

    return () => { try { sub?.unsubscribe(); } catch {} };
  }, [hasManualPayment, api]);

  if (!hasManualPayment || !paymentUrl) return null;

  return (
    <BlockStack spacing="base">
      <Text size="large">Pay with Bitcoin</Text>
      <Button to={paymentUrl}>Complete payment with Bitcoin Lightning</Button>
    </BlockStack>
  );
}