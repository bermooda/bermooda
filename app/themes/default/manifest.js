import AccountAddressesPage from '#/themes/default/components/account-addresses-page';
import AccountDashboard from '#/themes/default/components/account-dashboard';
import AccountLayout from '#/themes/default/components/account-layout';
import AccountLoyaltyPage from '#/themes/default/components/account-loyalty-page';
import AccountOrderDetailPage from '#/themes/default/components/account-order-detail-page';
import AccountOrdersPage from '#/themes/default/components/account-orders-page';
import AccountProfilePage from '#/themes/default/components/account-profile-page';
import AccountWishlistPage from '#/themes/default/components/account-wishlist-page';
import CartPage from '#/themes/default/components/cart-page';
import CategoryPage from '#/themes/default/components/category-page';
import CheckoutLayout from '#/themes/default/components/checkout-layout';
import CheckoutThankYouPage from '#/themes/default/components/checkout-thank-you-page';
import CollectionPage from '#/themes/default/components/collection-page';
import ForgotPasswordPage from '#/themes/default/components/forgot-password-page';
import HomePage from '#/themes/default/components/home-page';
import Layout from '#/themes/default/components/layout';
import LoginPage from '#/themes/default/components/login-page';
import NotFoundPage from '#/themes/default/components/not-found-page';
import PagePage from '#/themes/default/components/page-page';
import ProductPage from '#/themes/default/components/product-page';
import RegisterPage from '#/themes/default/components/register-page';
import ResetPasswordPage from '#/themes/default/components/reset-password-page';
import SearchPage from '#/themes/default/components/search-page';

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
};
