import paypal from '../../helpers/paypal.js';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET);

const prisma = new PrismaClient();

// Create Order
export const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartItems,
      addressInfo,
      orderStatus,
      paymentMethod,
      paymentStatus,
      totalAmount,
      orderDate,
      orderUpdateDate,
      paymentId,
      payerId,
      cartId,
    } = req.body;

    if (paymentMethod === 'paypal') {
      const create_payment_json = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal',
        },
        redirect_urls: {
          return_url: 'http://localhost:5173/shop/paypal-return',
          cancel_url: 'http://localhost:5173/shop/paypal-cancel',
        },
        transactions: [
          {
            item_list: {
              items: cartItems.map((item) => ({
                name: item.title,
                sku: item.productId,
                price: item.price.toFixed(2),
                currency: 'USD',
                quantity: item.quantity,
              })),
            },
            amount: {
              currency: 'USD',
              total: totalAmount.toFixed(2),
            },
            description: 'description',
          },
        ],
      };

      paypal.payment.create(create_payment_json, async (error, paymentInfo) => {
        if (error) {
          console.log(error);
          return res.status(500).json({
            success: false,
            message: 'Error while creating PayPal payment',
          });
        } else {
          const newlyCreatedOrder = await prisma.order.create({
            data: {
              userId: parseInt(userId),
              cartId,
              cartItems,
              addressInfo,
              orderStatus,
              paymentMethod,
              paymentStatus,
              totalAmount,
              orderDate,
              orderUpdateDate,
              paymentId,
              payerId,
            },
          });

          const approvalURL = paymentInfo.links.find(
            (link) => link.rel === 'approval_url'
          ).href;

          res.status(201).json({
            success: true,
            approvalURL,
            orderId: newlyCreatedOrder.id,
          });
        }
      });
    } else if (paymentMethod === 'stripe') {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: cartItems.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.title,
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: 'http://localhost:5173/shop/stripe-success',
        cancel_url: 'http://localhost:5173/shop/stripe-cancel',
      });

      const newlyCreatedOrder = await prisma.order.create({
        data: {
          userId: parseInt(userId),
          cartId,
          cartItems,
          addressInfo,
          orderStatus,
          paymentMethod,
          paymentStatus,
          totalAmount,
          orderDate,
          orderUpdateDate,
          paymentId: session.id,
        },
      });

      res.status(201).json({
        success: true,
        sessionId: session.id,
        orderId: newlyCreatedOrder.id,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid payment method',
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: 'Some error occurred!',
    });
  }
};

// Capture Payment
export const capturePayment = async (req, res) => {
  try {
    const { paymentId, payerId, orderId, paymentMethod } = req.body;

    let order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { cartItems: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order cannot be found',
      });
    }

    if (paymentMethod === 'paypal') {
      order = await prisma.order.update({
        where: { id: parseInt(order.id) },
        data: {
          paymentStatus: 'paid',
          orderStatus: 'confirmed',
          paymentId,
          payerId,
        },
      });
    } else if (paymentMethod === 'stripe') {
      const session = await stripe.checkout.sessions.retrieve(paymentId);
      if (session.payment_status === 'paid') {
        order = await prisma.order.update({
          where: { id: parseInt(order.id) },
          data: {
            paymentStatus: 'paid',
            orderStatus: 'confirmed',
            paymentId,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Payment not completed',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method',
      });
    }

    // Update product stock
    for (let item of order.cartItems) {
      let product = await prisma.product.findUnique({
        where: { id: parseInt(item.productId) },
      });

      if (!product || product.totalStock < item.quantity) {
        return res.status(404).json({
          success: false,
          message: `Not enough stock for this product ${
            product ? product.title : 'N/A'
          }`,
        });
      }

      await prisma.product.update({
        where: { id: parseInt(product.id) },
        data: {
          totalStock: product.totalStock - item.quantity,
        },
      });
    }

    await prisma.cart.delete({
      where: { id: parseInt(order.cartId) },
    });

    res.status(200).json({
      success: true,
      message: 'Order confirmed',
      data: order,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: 'Some error occurred!',
    });
  }
};

// Get All Orders by User
export const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await prisma.order.findMany({
      where: { userId: parseInt(userId) },
    });

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: 'No orders found!',
      });
    }

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: 'Some error occurred!',
    });
  }
};

// Get Order Details
export const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found!',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: 'Some error occurred!',
    });
  }
};
