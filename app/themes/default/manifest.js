import AccountAddressesPage from '#/themes/default/components/account-addresses-page';
import AccountDashboard from '#/themes/default/components/account-dashboard';
import AccountLayout from '#/themes/default/components/account-layout';
import AccountOrderDetailPage from '#/themes/default/components/account-order-detail-page';
import AccountOrdersPage from '#/themes/default/components/account-orders-page';
import AccountProfilePage from '#/themes/default/components/account-profile-page';
import CartPage from '#/themes/default/components/cart-page';
import CategoryPage from '#/themes/default/components/category-page';
import CheckoutLayout from '#/themes/default/components/checkout-layout';
import CheckoutThankYouPage from '#/themes/default/components/checkout-thank-you-page';
import CurrencySwitcher from '#/themes/default/components/currency-switcher';
import ForgotPasswordPage from '#/themes/default/components/forgot-password-page';
import HomePage from '#/themes/default/components/home-page';
import Layout from '#/themes/default/components/layout';
import LocaleSwitcher from '#/themes/default/components/locale-switcher';
import LoginPage from '#/themes/default/components/login-page';
import NotFoundPage from '#/themes/default/components/not-found-page';
import PagePage from '#/themes/default/components/page-page';
import ProductCard from '#/themes/default/components/product-card';
import ProductGrid from '#/themes/default/components/product-grid';
import ProductPage from '#/themes/default/components/product-page';
import RegisterPage from '#/themes/default/components/register-page';
import ResetPasswordPage from '#/themes/default/components/reset-password-page';

export default {
  id: 'default',
  name: 'Default',
  version: '1.0.0',
  description: 'The default bermooda storefront theme.',
  components: {
    Layout,
    HomePage,
    ProductPage,
    PagePage,
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
