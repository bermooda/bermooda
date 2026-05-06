import AccountAddressesPage from './components/AccountAddressesPage';
import AccountDashboard from './components/AccountDashboard';
import AccountLayout from './components/AccountLayout';
import AccountOrderDetailPage from './components/AccountOrderDetailPage';
import AccountOrdersPage from './components/AccountOrdersPage';
import AccountProfilePage from './components/AccountProfilePage';
import CartPage from './components/CartPage';
import CategoryPage from './components/CategoryPage';
import CheckoutLayout from './components/CheckoutLayout';
import CheckoutThankYouPage from './components/CheckoutThankYouPage';
import CurrencySwitcher from './components/CurrencySwitcher';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import HomePage from './components/HomePage';
import Layout from './components/Layout';
import LocaleSwitcher from './components/LocaleSwitcher';
import LoginPage from './components/LoginPage';
import NotFoundPage from './components/NotFoundPage';
import ProductCard from './components/ProductCard';
import ProductGrid from './components/ProductGrid';
import ProductPage from './components/ProductPage';
import RegisterPage from './components/RegisterPage';
import ResetPasswordPage from './components/ResetPasswordPage';

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
