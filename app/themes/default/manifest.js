import AccountAddressesPage from './components/account-addresses-page';
import AccountDashboard from './components/account-dashboard';
import AccountLayout from './components/account-layout';
import AccountOrderDetailPage from './components/account-order-detail-page';
import AccountOrdersPage from './components/account-orders-page';
import AccountProfilePage from './components/account-profile-page';
import CartPage from './components/cart-page';
import CategoryPage from './components/category-page';
import CheckoutLayout from './components/checkout-layout';
import CheckoutThankYouPage from './components/checkout-thank-you-page';
import CurrencySwitcher from './components/currency-switcher';
import ForgotPasswordPage from './components/forgot-password-page';
import HomePage from './components/home-page';
import Layout from './components/layout';
import LocaleSwitcher from './components/locale-switcher';
import LoginPage from './components/login-page';
import NotFoundPage from './components/not-found-page';
import ProductCard from './components/product-card';
import ProductGrid from './components/product-grid';
import ProductPage from './components/product-page';
import RegisterPage from './components/register-page';
import ResetPasswordPage from './components/reset-password-page';

export default {
  id: 'default',
  name: 'Default',
  version: '1.0.0',
  description: 'The default bermooda storefront theme.',
  components: {
    Layout,
    HomePage,
    ProductPage,
    CategoryPage,
    CartPage,
    CheckoutLayout,
    CheckoutThankYouPage,
    NotFoundPage,
    ProductCard,
    ProductGrid,
    AccountLayout,
    AccountDashboard,
    AccountOrdersPage,
    AccountOrderDetailPage,
    AccountAddressesPage,
    AccountProfilePage,
    LoginPage,
    RegisterPage,
    ForgotPasswordPage,
    ResetPasswordPage,
    LocaleSwitcher,
    CurrencySwitcher,
  },
};
