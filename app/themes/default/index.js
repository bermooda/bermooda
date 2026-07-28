import { defineTheme } from '#/core/themes/define';

import AccountAddressesPage from './components/account-addresses-page';
import AccountDashboard from './components/account-dashboard';
import AccountLayout from './components/account-layout';
import AccountLoyaltyPage from './components/account-loyalty-page';
import AccountOrderDetailPage from './components/account-order-detail-page';
import AccountOrdersPage from './components/account-orders-page';
import AccountProfilePage from './components/account-profile-page';
import AccountWishlistPage from './components/account-wishlist-page';
import CartPage from './components/cart-page';
import CategoryPage from './components/category-page';
import CheckoutLayout from './components/checkout-layout';
import CheckoutThankYouPage from './components/checkout-thank-you-page';
import CollectionPage from './components/collection-page';
import ForgotPasswordPage from './components/forgot-password-page';
import HomePage from './components/home-page';
import Layout from './components/layout';
import LoginPage from './components/login-page';
import NotFoundPage from './components/not-found-page';
import PagePage from './components/page-page';
import ProductPage from './components/product-page';
import RegisterPage from './components/register-page';
import ResetPasswordPage from './components/reset-password-page';
import SearchPage from './components/search-page';

export default defineTheme({
  components: {
    Layout,
    HomePage,
    ProductPage,
    PagePage,
    CategoryPage,
    CollectionPage,
    CartPage,
    CheckoutLayout,
    CheckoutThankYouPage,
    NotFoundPage,
    AccountLayout,
    AccountDashboard,
    AccountOrdersPage,
    AccountOrderDetailPage,
    AccountAddressesPage,
    AccountProfilePage,
    AccountWishlistPage,
    AccountLoyaltyPage,
    LoginPage,
    RegisterPage,
    ForgotPasswordPage,
    ResetPasswordPage,
    SearchPage,
  },
});
