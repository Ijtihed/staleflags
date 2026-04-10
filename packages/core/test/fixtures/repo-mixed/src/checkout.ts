export function checkout() {
  if (process.env.ENABLE_NEW_CHECKOUT) {
    return newCheckoutFlow();
  } else {
    return oldCheckoutFlow();
  }
}

function newCheckoutFlow() {
  return 'new';
}

function oldCheckoutFlow() {
  return 'old';
}
